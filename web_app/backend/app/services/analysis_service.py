import json
from pathlib import Path
from typing import Any
from app.domain.models.roi import ROICoordinates, FrameMetadata
from app.domain.models.job import JobInfo, LegacyAnalysisResponse
from app.domain.models.checkpoint import (
    IntraModeData,
    IntraSearchSummary,
    IntraRefCheckpoint,
    IntraComparisonResult,
    CTUPartitionCheckpoint,
    TransformQuantCheckpoint
)
from app.domain.enums import JobStatus, StageEnum
from app.domain.exceptions import JobNotFoundError, EncoderExecutionError, InvalidInputError
from app.engine.interfaces import IEncoderRunner, IVideoProcessor
from app.engine.ffmpeg_adapter import ffmpeg_adapter
from app.engine.hm_runner import hm_runner
from app.storage.session_manager import session_manager, SessionManager
from app.storage.trace_reader import trace_reader, TraceReader
from app.checkpoints.registry import checkpoint_registry, CheckpointRegistry
from app.checkpoints.parsers.intra_search_parser import intra_search_parser
from app.checkpoints.parsers.intra_ref_parser import intra_ref_parser
from app.checkpoints.parsers.partition_parser import partition_parser
from app.checkpoints.parsers.transform_parser import transform_quant_parser
from app.services.job_manager import job_manager, JobManager as JobManagerClass

class AnalysisService:
    """Orchestrates HEVC video processing, HM encoder execution, and checkpoint analysis"""
    
    def __init__(
        self,
        video_processor: IVideoProcessor | None = None,
        encoder_runner: IEncoderRunner | None = None,
        storage: SessionManager | None = None,
        reader: TraceReader | None = None,
        registry: CheckpointRegistry | None = None,
        job_mgr: JobManagerClass | None = None
    ):
        self.video_processor = video_processor or ffmpeg_adapter
        self.encoder_runner = encoder_runner or hm_runner
        self.storage = storage or session_manager
        self.reader = reader or trace_reader
        self.registry = registry or checkpoint_registry
        self.job_mgr = job_mgr or job_manager

    @staticmethod
    def compute_frame_dimensions(orig_w: int, orig_h: int, scale_mode: str) -> tuple[int, int]:
        """Compute aligned width & height conforming to HEVC 8-pixel alignment and scale_mode."""
        if scale_mode == "fast":
            target_max_w, target_max_h = 640, 360
            if orig_w > target_max_w or orig_h > target_max_h:
                scale = min(target_max_w / orig_w, target_max_h / orig_h)
                calc_w = max(64, int(orig_w * scale))
                calc_h = max(64, int(orig_h * scale))
            else:
                calc_w, calc_h = orig_w, orig_h
        else:
            calc_w, calc_h = orig_w, orig_h

        calc_w = max(64, round(calc_w / 8) * 8)
        calc_h = max(64, round(calc_h / 8) * 8)
        return calc_w, calc_h

    def _resolve_target_roi(
        self,
        job_id: str,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
    ) -> tuple[int | None, int | None, int | None]:
        """Resolve ROI parameters from explicit args or fallback to the job's recorded ROI."""
        target_cu, target_x, target_y = cu_size, ctu_x, ctu_y
        if target_cu is None or target_x is None or target_y is None:
            job = self.job_mgr._jobs.get(job_id)
            if job and job.roi:
                if target_cu is None and job.roi.cu_size > 0:
                    target_cu = job.roi.cu_size
                if target_x is None:
                    target_x = job.roi.ctu_x
                if target_y is None:
                    target_y = job.roi.ctu_y
        return target_cu, target_x, target_y

    @staticmethod
    def _build_roi_predicate(
        event_name: str | None = None,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
    ):
        """Create a predicate function to filter trace events by event name and ROI."""
        def predicate(e: dict) -> bool:
            if event_name is not None and e.get("event") != event_name:
                return False
            if cu_size is not None and e.get("cu_size") != cu_size:
                return False
            if ctu_x is not None and e.get("ctu_x") != ctu_x:
                return False
            if ctu_y is not None and e.get("ctu_y") != ctu_y:
                return False
            return True
        return predicate

    @staticmethod
    def _build_fallback_ref_checkpoint(raw_mode: dict) -> IntraRefCheckpoint:
        """Construct IntraRefCheckpoint from RDO_INTRA_SEARCH event when INTRA_REF_SAMPLES is absent."""
        ref_top = raw_mode.get("ref_top", [])
        ref_left = raw_mode.get("ref_left", [])
        ref_top_u = raw_mode.get("ref_top_u", [])
        ref_left_u = raw_mode.get("ref_left_u", [])
        ref_top_v = raw_mode.get("ref_top_v", [])
        ref_left_v = raw_mode.get("ref_left_v", [])
        return IntraRefCheckpoint(
            poc=raw_mode.get("poc", 0),
            ctu_x=raw_mode.get("ctu_x", 0),
            ctu_y=raw_mode.get("ctu_y", 0),
            cu_size=raw_mode.get("cu_size", 8),
            ref_unfilt_top=ref_top,
            ref_unfilt_left=ref_left,
            ref_filt_top=ref_top,
            ref_filt_left=ref_left,
            ref_unfilt_top_u=ref_top_u,
            ref_unfilt_left_u=ref_left_u,
            ref_unfilt_top_v=ref_top_v,
            ref_unfilt_left_v=ref_left_v,
            ref_filt_top_u=ref_top_u,
            ref_filt_left_u=ref_left_u,
            ref_filt_top_v=ref_top_v,
            ref_filt_left_v=ref_left_v,
            luma_ref_count=len(ref_top)
        )

    async def execute_analysis_pipeline(
        self,
        job_id: str,
        input_image_path: Path,
        roi: ROICoordinates,
        scale_mode: str = "native"
    ) -> JobInfo:
        session_dir = self.storage.get_session_dir(job_id)
        yuv_output = self.storage.get_yuv_path(job_id)
        
        try:
            await self.job_mgr.update_status(job_id, JobStatus.RUNNING)
            
            # 1. Convert & Crop with FFmpeg
            frame_meta = await self.video_processor.process_image_to_yuv(
                input_image=input_image_path,
                output_yuv=yuv_output,
                roi=roi,
                scale_mode=scale_mode
            )
            
            # 2. Run Encoder
            trace_path = await self.encoder_runner.run_encode(
                yuv_input=yuv_output,
                session_dir=session_dir,
                frame_meta=frame_meta,
                roi=roi
            )
            
            # 3. Read trace events matching target cu_size
            target_cu_size = roi.cu_size if roi.cu_size > 0 else 8
            raw_modes = self.reader.read_all(
                trace_path,
                event_filter="RDO_INTRA_SEARCH",
                limit=35,
                predicate=lambda e: e.get("cu_size") == target_cu_size
            )
            if not raw_modes:
                raw_modes = self.reader.read_all(trace_path, event_filter="RDO_INTRA_SEARCH", limit=35)
            if not raw_modes:
                raise EncoderExecutionError("No Intra Search trace events were captured from encoder.")
                
            parsed_modes = [intra_search_parser.parse_event(m) for m in raw_modes]
            summary = intra_search_parser.compute_summary(parsed_modes)
            
            # Check and register all available stages dynamically
            stages = []
            if self.reader.find_one(trace_path, lambda e: e.get("event") == "CTU_PARTITION"):
                stages.append(StageEnum.CP_01_PARTITION.value)
            if self.reader.find_one(trace_path, lambda e: e.get("event") == "INTRA_REF_SAMPLES"):
                stages.append(StageEnum.CP_02_INTRA_REF.value)
            stages.append(StageEnum.CP_03_INTRA_SEARCH.value)
            if self.reader.find_one(trace_path, lambda e: e.get("event") == "TRANSFORM_QUANT"):
                stages.append(StageEnum.CP_06_TRANSFORM.value)
                stages.append(StageEnum.CP_07_QUANT.value)
                
            await self.job_mgr.set_result(
                job_id=job_id,
                best_mode=summary.best_mode,
                best_cost=summary.best_cost,
                stages=stages
            )
            
            return await self.job_mgr.get_job(job_id)
            
        except Exception as e:
            await self.job_mgr.update_status(job_id, JobStatus.FAILED, error_message=str(e))
            raise

    async def run_synchronous_analysis(
        self,
        image_bytes: bytes,
        ctu_x: int = 0,
        ctu_y: int = 0,
        cu_size: int = 8,
        scale_mode: str = "native"
    ) -> LegacyAnalysisResponse:
        """Backward-compatible endpoint for existing frontend App.jsx"""
        job_id = self.storage.create_session()
        input_image = self.storage.get_input_image_path(job_id)
        
        with open(input_image, "wb") as f:
            f.write(image_bytes)
            
        roi = ROICoordinates(ctu_x=ctu_x, ctu_y=ctu_y, cu_size=cu_size)
        
        # Calculate provisional metadata from image
        from PIL import Image
        with Image.open(input_image) as img:
            orig_w, orig_h = img.size
            
        calc_w, calc_h = self.compute_frame_dimensions(orig_w, orig_h, scale_mode)
        num_ctu_w = (calc_w + 63) // 64
        num_ctu_h = (calc_h + 63) // 64

        frame_meta = FrameMetadata(
            width=calc_w,
            height=calc_h,
            aligned_width=calc_w,
            aligned_height=calc_h,
            max_ctu_x=max(0, num_ctu_w - 1),
            max_ctu_y=max(0, num_ctu_h - 1),
            ctu_size=64
        )
        
        await self.job_mgr.create_job(roi=roi, frame=frame_meta, job_id=job_id)
        job_info = await self.execute_analysis_pipeline(job_id, input_image, roi, scale_mode=scale_mode)
        
        # Retrieve raw modes for legacy format
        trace_path = self.storage.get_trace_path(job_id)
        target_cu_size = roi.cu_size if roi.cu_size > 0 else 8
        raw_modes = self.reader.read_all(
            trace_path,
            event_filter="RDO_INTRA_SEARCH",
            limit=35,
            predicate=lambda e: e.get("cu_size") == target_cu_size
        )
        if not raw_modes:
            raw_modes = self.reader.read_all(trace_path, event_filter="RDO_INTRA_SEARCH", limit=35)
        
        # Retrieve intra ref data if available
        ref_checkpoint = None
        try:
            ref_checkpoint = self.get_intra_ref_data(job_id, cu_size=target_cu_size, ctu_x=roi.ctu_x, ctu_y=roi.ctu_y)
        except Exception:
            pass
        
        return LegacyAnalysisResponse(
            status="success",
            job_id=job_id,
            data=raw_modes,
            width=job_info.frame.width,
            height=job_info.frame.height,
            ctu_x=job_info.roi.ctu_x,
            ctu_y=job_info.roi.ctu_y,
            best_mode=job_info.best_mode or 0,
            best_cost=job_info.best_cost or 0.0,
            ref_samples=ref_checkpoint.model_dump() if ref_checkpoint else None
        )

    def get_intra_search_data(
        self,
        job_id: str,
        mode: int | None = None,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None
    ) -> list[IntraModeData]:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)
            
        target_cu, target_x, target_y = self._resolve_target_roi(job_id, cu_size, ctu_x, ctu_y)
        predicate = None
        if target_cu is not None or target_x is not None or target_y is not None:
            predicate = self._build_roi_predicate(cu_size=target_cu, ctu_x=target_x, ctu_y=target_y)

        raw_modes = self.reader.read_all(trace_path, event_filter="RDO_INTRA_SEARCH", limit=35, predicate=predicate)
        if not raw_modes and predicate is not None:
            raw_modes = self.reader.read_all(trace_path, event_filter="RDO_INTRA_SEARCH", limit=35)
            
        parsed = [intra_search_parser.parse_event(m) for m in raw_modes]
        ranked = intra_search_parser.enrich_and_rank(parsed)
        
        if mode is not None:
            return [m for m in ranked if m.mode == mode]
        return ranked

    def get_intra_search_summary(self, job_id: str) -> IntraSearchSummary:
        modes = self.get_intra_search_data(job_id)
        return intra_search_parser.compute_summary(modes)

    def get_intra_ref_data(
        self,
        job_id: str,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None
    ) -> IntraRefCheckpoint:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)
            
        target_cu, target_x, target_y = self._resolve_target_roi(job_id, cu_size, ctu_x, ctu_y)
        ref_pred = self._build_roi_predicate(
            event_name="INTRA_REF_SAMPLES",
            cu_size=target_cu,
            ctu_x=target_x,
            ctu_y=target_y
        )

        raw_ref = self.reader.find_one(trace_path, ref_pred)
        if not raw_ref:
            raw_ref = self.reader.find_one(trace_path, lambda e: e.get("event") == "INTRA_REF_SAMPLES")
            
        if not raw_ref:
            rdo_pred = self._build_roi_predicate(
                event_name="RDO_INTRA_SEARCH",
                cu_size=target_cu
            )
            raw_mode = self.reader.find_one(trace_path, rdo_pred)
            if not raw_mode:
                raw_mode = self.reader.find_one(trace_path, lambda e: e.get("event") == "RDO_INTRA_SEARCH")
            if not raw_mode:
                raise JobNotFoundError(job_id)
            return self._build_fallback_ref_checkpoint(raw_mode)
            
        return intra_ref_parser.parse_event(raw_ref)

    def compare_intra_modes(
        self,
        job_id: str,
        mode_a: int,
        mode_b: int,
        cu_size: int | None = None
    ) -> IntraComparisonResult:
        modes = self.get_intra_search_data(job_id, cu_size=cu_size)
        m_a = next((m for m in modes if m.mode == mode_a), None)
        m_b = next((m for m in modes if m.mode == mode_b), None)
        
        if not m_a:
            raise InvalidInputError(f"Mode {mode_a} not found in job {job_id}")
        if not m_b:
            raise InvalidInputError(f"Mode {mode_b} not found in job {job_id}")
            
        diff_matrix = [pa - pb for pa, pb in zip(m_a.pred_data, m_b.pred_data)]
        sad_diff = sum(abs(d) for d in diff_matrix)
        cost_diff = round(m_b.cost - m_a.cost, 4)
        better_mode = m_a.mode if m_a.cost <= m_b.cost else m_b.mode
        
        # Residual and SSE comparison
        resi_diff = [ra - rb for ra, rb in zip(m_a.resi_data, m_b.resi_data)] if m_a.resi_data and m_b.resi_data else []
        sse_a = sum(ra * ra for ra in m_a.resi_data) if m_a.resi_data else 0
        sse_b = sum(rb * rb for rb in m_b.resi_data) if m_b.resi_data else 0
        sse_diff = sse_b - sse_a
        
        return IntraComparisonResult(
            mode_a=m_a.mode,
            mode_b=m_b.mode,
            direction_a=m_a.direction_name,
            direction_b=m_b.direction_name,
            cost_a=m_a.cost,
            cost_b=m_b.cost,
            cost_difference=cost_diff,
            better_mode=better_mode,
            pixel_sad_diff=sad_diff,
            pixel_diff_matrix=diff_matrix,
            resi_diff_matrix=resi_diff,
            sse_a=sse_a,
            sse_b=sse_b,
            sse_diff=sse_diff,
            cu_size=m_a.cu_size
        )

    def get_partition_data(self, job_id: str) -> CTUPartitionCheckpoint:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)
            
        raw_part = self.reader.find_one(trace_path, lambda e: e.get("event") == "CTU_PARTITION")
        if not raw_part:
            return CTUPartitionCheckpoint(cu_size=64, nodes=[])
            
        return partition_parser.parse_event(raw_part)

    def get_all_partitions(self, job_id: str) -> list[CTUPartitionCheckpoint]:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)
            
        raw_parts = self.reader.read_all(trace_path, event_filter="CTU_PARTITION")
        return [partition_parser.parse_event(p) for p in raw_parts]

    def get_transform_quant_data(self, job_id: str, comp: str | None = None) -> list[TransformQuantCheckpoint]:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)
            
        raw_events = self.reader.read_all(trace_path, event_filter="TRANSFORM_QUANT")
        parsed = [transform_quant_parser.parse_event(e) for e in raw_events]
        if comp and comp.strip():
            target_comp = comp.strip().upper()
            return [t for t in parsed if t.component.upper() == target_comp]
        return parsed

analysis_service = AnalysisService()
