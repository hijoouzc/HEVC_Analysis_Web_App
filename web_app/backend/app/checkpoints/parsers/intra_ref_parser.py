from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.models.checkpoint import IntraRefCheckpoint
from app.domain.enums import StageEnum

class IntraRefParser(BaseCheckpointParser):
    @property
    def stage_id(self) -> str:
        return StageEnum.CP_02_INTRA_REF.value
        
    @property
    def event_name(self) -> str:
        return "INTRA_REF_SAMPLES"
        
    def parse_event(self, raw_data: dict[str, Any]) -> IntraRefCheckpoint:
        unfilt_top = raw_data.get("ref_unfilt_top", [])
        unfilt_left = raw_data.get("ref_unfilt_left", [])
        filt_top = raw_data.get("ref_filt_top", [])
        filt_left = raw_data.get("ref_filt_left", [])
        
        # Calculate filter diffs
        diffs = []
        if unfilt_top and filt_top:
            diffs.extend([abs(u - f) for u, f in zip(unfilt_top, filt_top)])
        if unfilt_left and filt_left:
            diffs.extend([abs(u - f) for u, f in zip(unfilt_left, filt_left)])
            
        max_diff = max(diffs) if diffs else 0
        avg_diff = round(sum(diffs) / len(diffs), 2) if diffs else 0.0
        
        return IntraRefCheckpoint(
            poc=raw_data.get("poc", 0),
            ctu_x=raw_data.get("ctu_x", 0),
            ctu_y=raw_data.get("ctu_y", 0),
            cu_size=raw_data.get("cu_size", 8),
            strong_smoothing=raw_data.get("strong_smoothing", False),
            ref_unfilt_top=unfilt_top,
            ref_unfilt_left=unfilt_left,
            ref_filt_top=filt_top,
            ref_filt_left=filt_left,
            ref_unfilt_top_u=raw_data.get("ref_unfilt_top_u", []),
            ref_unfilt_left_u=raw_data.get("ref_unfilt_left_u", []),
            ref_unfilt_top_v=raw_data.get("ref_unfilt_top_v", []),
            ref_unfilt_left_v=raw_data.get("ref_unfilt_left_v", []),
            ref_filt_top_u=raw_data.get("ref_filt_top_u", []),
            ref_filt_left_u=raw_data.get("ref_filt_left_u", []),
            ref_filt_top_v=raw_data.get("ref_filt_top_v", []),
            ref_filt_left_v=raw_data.get("ref_filt_left_v", []),
            luma_ref_count=len(unfilt_top),
            filter_applied=bool(max_diff > 0),
            max_filter_diff=max_diff,
            avg_filter_diff=avg_diff
        )

intra_ref_parser = IntraRefParser()
