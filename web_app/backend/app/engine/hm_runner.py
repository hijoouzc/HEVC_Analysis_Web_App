import os
import asyncio
import shutil
from pathlib import Path
from app.domain.models.roi import ROICoordinates, FrameMetadata
from app.domain.exceptions import EncoderExecutionError
from app.core.config import settings

class HMEncoderRunner:
    """Executes the reference HM C++ encoder with isolated ROI environment and output paths"""
    
    def __init__(self, encoder_bin: Path | None = None, cfg_path: Path | None = None):
        self.encoder_bin = encoder_bin or settings.ENCODER_BIN
        self.cfg_path = cfg_path or settings.DEFAULT_CFG
        
    async def run_encode(
        self,
        yuv_input: Path,
        session_dir: Path,
        frame_meta: FrameMetadata,
        roi: ROICoordinates
    ) -> Path:
        if not self.encoder_bin.exists():
            raise EncoderExecutionError(f"Encoder binary not found at: {self.encoder_bin}")
        if not self.cfg_path.exists():
            raise EncoderExecutionError(f"Config file not found at: {self.cfg_path}")
            
        trace_output = session_dir / "trace.jsonl"
        if trace_output.exists():
            trace_output.unlink()
            
        env = os.environ.copy()
        env["VISUAL_CTU_X"] = str(roi.ctu_x)
        env["VISUAL_CTU_Y"] = str(roi.ctu_y)
        env["VISUAL_CU_SIZE"] = str(roi.cu_size)
        env["VISUAL_DUMP_EXIT"] = "0"
        env["VISUAL_OUTPUT_DIR"] = str(session_dir)
        
        cmd = [
            str(self.encoder_bin),
            "-c", str(self.cfg_path),
            "-i", str(yuv_input),
            "-wdt", str(frame_meta.aligned_width),
            "-hgt", str(frame_meta.aligned_height),
            "-fr", str(settings.DEFAULT_FPS),
            "-f", str(settings.DEFAULT_FRAMES)
        ]
        
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(settings.PROJECT_ROOT),
            env=env
        )
        
        _, stderr = await proc.communicate()
        
        # Also copy trace to legacy dump_data/trace.jsonl for compatibility with direct file observers
        if trace_output.exists() and trace_output.stat().st_size > 0:
            try:
                settings.LEGACY_DUMP_DIR.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(trace_output, settings.LEGACY_DUMP_DIR / "trace.jsonl")
            except Exception:
                pass
            return trace_output
            
        # Check if legacy file was written instead (e.g. if custom output dir fell back)
        legacy_trace = settings.LEGACY_DUMP_DIR / "trace.jsonl"
        if legacy_trace.exists() and legacy_trace.stat().st_size > 0:
            shutil.copyfile(legacy_trace, trace_output)
            return trace_output
            
        err_msg = stderr.decode(errors="replace") if stderr else "HM Encoder did not generate trace data."
        raise EncoderExecutionError(err_msg, proc.returncode or -1)

hm_runner = HMEncoderRunner()
