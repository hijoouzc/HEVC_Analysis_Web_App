from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.models.checkpoint import IntraModeData, IntraSearchSummary
from app.domain.enums import StageEnum

ANG_TABLE = [0, 2, 5, 9, 13, 17, 21, 26, 32]

def get_intra_mode_hevc_info(mode: int) -> tuple[str, str, int]:
    """
    Computes standard HEVC Intra Direction Name, Category, and IntraPredAngle offset.
    According to ITU-T H.265 / HM TComPrediction.cpp
    """
    if mode == 0:
        return "PLANAR", "Planar", 0
    elif mode == 1:
        return "DC", "DC", 0
    elif mode == 10:
        return "ANGULAR", "Horizontal", 0
    elif mode == 26:
        return "ANGULAR", "Vertical", 0
    elif mode == 2:
        return "ANGULAR", "Diagonal Bottom-Left (45°)", 32
    elif mode == 18:
        return "ANGULAR", "Diagonal Top-Left (45°)", -32
    elif mode == 34:
        return "ANGULAR", "Diagonal Top-Right (45°)", 32
        
    is_ver = (mode >= 18)
    angle_mode = (mode - 26) if is_ver else (10 - mode)
    abs_angle_mode = abs(angle_mode)
    sign = -1 if angle_mode < 0 else 1
    abs_ang = ANG_TABLE[abs_angle_mode] if abs_angle_mode < len(ANG_TABLE) else 0
    angle_offset = sign * abs_ang
    
    base_name = "Vertical" if is_ver else "Horizontal"
    dir_name = f"{base_name} ({'+' if angle_offset > 0 else ''}{angle_offset}/32)"
    return "ANGULAR", dir_name, angle_offset

class IntraSearchParser(BaseCheckpointParser):
    @property
    def stage_id(self) -> str:
        return StageEnum.CP_03_INTRA_SEARCH.value
        
    @property
    def event_name(self) -> str:
        return "RDO_INTRA_SEARCH"
        
    def parse_event(self, raw_data: dict[str, Any]) -> IntraModeData:
        mode = raw_data.get("mode", 0)
        category, dir_name, angle_offset = get_intra_mode_hevc_info(mode)
        
        # Merge parsed metadata
        data_copy = dict(raw_data)
        data_copy["category"] = category
        data_copy["direction_name"] = dir_name
        data_copy["angle_offset"] = angle_offset
        data_copy["b_use_filter"] = raw_data.get("b_use_filter", False)
        
        return IntraModeData(**data_copy)

    def enrich_and_rank(self, modes: list[IntraModeData]) -> list[IntraModeData]:
        if not modes:
            return []
            
        sorted_modes = sorted(modes, key=lambda m: m.cost)
        best_cost = sorted_modes[0].cost
        
        # Assign rank and cost_delta
        for idx, m in enumerate(sorted_modes, start=1):
            m.rank = idx
            m.cost_delta = round(m.cost - best_cost, 4)
            
        # Return in original mode order (mode 0..34)
        return sorted(sorted_modes, key=lambda m: m.mode)
        
    def compute_summary(self, modes_data: list[IntraModeData]) -> IntraSearchSummary:
        if not modes_data:
            return IntraSearchSummary(
                best_mode=0,
                best_cost=0.0,
                total_modes=0,
                modes=[],
                min_cost=0.0,
                max_cost=0.0,
                cu_size=8,
                ctu_x=0,
                ctu_y=0
            )
            
        best_item = min(modes_data, key=lambda m: m.cost)
        max_item = max(modes_data, key=lambda m: m.cost)
        
        return IntraSearchSummary(
            best_mode=best_item.mode,
            best_cost=round(best_item.cost, 4),
            total_modes=len(modes_data),
            modes=[m.mode for m in modes_data],
            min_cost=round(best_item.cost, 4),
            max_cost=round(max_item.cost, 4),
            cu_size=best_item.cu_size,
            ctu_x=best_item.ctu_x,
            ctu_y=best_item.ctu_y
        )

intra_search_parser = IntraSearchParser()
