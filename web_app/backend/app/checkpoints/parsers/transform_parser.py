from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.models.checkpoint import TransformQuantCheckpoint
from app.domain.enums import StageEnum

class TransformQuantParser(BaseCheckpointParser):
    def __init__(self, stage: str = StageEnum.CP_06_TRANSFORM.value):
        self._stage = stage

    @property
    def stage_id(self) -> str:
        return self._stage
        
    @property
    def event_name(self) -> str:
        return "TRANSFORM_QUANT"
        
    def parse_event(self, raw_data: dict[str, Any]) -> TransformQuantCheckpoint:
        dct = raw_data.get("dct_coeff", [])
        quant = raw_data.get("quant_coeff", [])
        
        dc_val = dct[0] if dct else 0
        total_energy = sum(c * c for c in dct)
        dc_energy = dc_val * dc_val
        energy_ratio = round(dc_energy / total_energy, 4) if total_energy > 0 else 0.0
        
        zero_count = sum(1 for q in quant if q == 0)
        sparsity = round(zero_count / len(quant), 4) if quant else 0.0
        
        tu_x_val = raw_data.get("tu_x")
        tu_y_val = raw_data.get("tu_y")
        
        return TransformQuantCheckpoint(
            poc=raw_data.get("poc", 0),
            ctu_x=raw_data.get("ctu_x", 0),
            ctu_y=raw_data.get("ctu_y", 0),
            tu_x=tu_x_val if tu_x_val is not None else 0,
            tu_y=tu_y_val if tu_y_val is not None else 0,
            width=raw_data.get("width", 8),
            height=raw_data.get("height", 8),
            cu_size=raw_data.get("cu_size", 8),
            component=raw_data.get("component", "Y"),
            qp=raw_data.get("qp", 32),
            resi_matrix=raw_data.get("resi_matrix", []),
            dct_coeff=dct,
            quant_coeff=quant,
            sig_coeff_count=raw_data.get("sig_coeff_count", sum(1 for q in quant if q != 0)),
            dc_coeff=dc_val,
            energy_compaction_ratio=energy_ratio,
            sparsity_ratio=sparsity
        )

transform_parser = TransformQuantParser(StageEnum.CP_06_TRANSFORM.value)
quant_parser = TransformQuantParser(StageEnum.CP_07_QUANT.value)
transform_quant_parser = transform_parser

