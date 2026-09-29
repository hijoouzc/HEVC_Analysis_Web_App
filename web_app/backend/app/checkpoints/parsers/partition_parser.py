from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.models.checkpoint import CTUPartitionCheckpoint, CUPartitionNode
from app.domain.enums import StageEnum

class PartitionParser(BaseCheckpointParser):
    @property
    def stage_id(self) -> str:
        return StageEnum.CP_01_PARTITION.value
        
    @property
    def event_name(self) -> str:
        return "CTU_PARTITION"
        
    def parse_event(self, raw_data: dict[str, Any]) -> CTUPartitionCheckpoint:
        raw_nodes = raw_data.get("nodes", [])
        nodes = [CUPartitionNode(**n) for n in raw_nodes]
        
        leaf_nodes = [n for n in nodes if not n.split]
        max_depth = max([n.depth for n in nodes], default=0)
        split_count = sum(1 for n in nodes if n.split)
        
        return CTUPartitionCheckpoint(
            poc=raw_data.get("poc", 0),
            ctu_x=raw_data.get("ctu_x", 0),
            ctu_y=raw_data.get("ctu_y", 0),
            cu_size=raw_data.get("cu_size", 64),
            nodes=nodes,
            total_nodes=len(nodes),
            leaf_nodes=len(leaf_nodes),
            max_depth=max_depth,
            split_count=split_count
        )

partition_parser = PartitionParser()
