from app.checkpoints.base_parser import BaseCheckpointParser
from app.checkpoints.parsers.intra_search_parser import intra_search_parser
from app.checkpoints.parsers.intra_ref_parser import intra_ref_parser
from app.checkpoints.parsers.partition_parser import partition_parser
from app.checkpoints.parsers.transform_parser import transform_parser, quant_parser

class CheckpointRegistry:
    def __init__(self):
        self._parsers_by_stage: dict[str, BaseCheckpointParser] = {}
        self._parsers_by_event: dict[str, BaseCheckpointParser] = {}
        self._descriptions: dict[str, tuple[str, str]] = {} # stage_id -> (Name, Description)
        
        # Sprint 3: Partitioning
        self.register(
            partition_parser,
            name="CTU QuadTree Partitioning",
            description="Recursively partitions 64x64 CTU into Coding Units (CUs) across depths 0-3 with Z-scan order."
        )
        
        # Sprint 2: Intra Reference & Prediction Search
        self.register(
            intra_ref_parser,
            name="Intra Reference Sample Preparation & Filtering",
            description="Extracts 4N+1 neighbor reference pixels before and after MDIS 3-tap / Strong Intra Smoothing."
        )
        self.register(
            intra_search_parser,
            name="Intra Prediction Mode Search",
            description="Evaluates all 35 directional, planar, and DC intra prediction candidates and calculates RD cost."
        )
        
        # Sprint 3: Transform & Quantization
        self.register(
            transform_parser,
            name="Residual 2D Transform (DCT/DST)",
            description="Transforms spatial residual matrix into 2D frequency coefficients and evaluates energy compaction."
        )
        self.register(
            quant_parser,
            name="Forward Quantization (QCoeff)",
            description="Applies scalar quantization with QP scaling, analyzing high-frequency zeroing and sparsity ratio."
        )

    def register(self, parser: BaseCheckpointParser, name: str, description: str):
        self._parsers_by_stage[parser.stage_id] = parser
        self._parsers_by_event[parser.event_name] = parser
        self._descriptions[parser.stage_id] = (name, description)

    def get_by_stage(self, stage_id: str) -> BaseCheckpointParser | None:
        return self._parsers_by_stage.get(stage_id)

    def get_by_event(self, event_name: str) -> BaseCheckpointParser | None:
        return self._parsers_by_event.get(event_name)

    def get_metadata(self, stage_id: str) -> tuple[str, str]:
        return self._descriptions.get(stage_id, (stage_id, ""))

    def list_available_stages(self) -> list[dict[str, str]]:
        return [
            {
                "stage_id": stage_id,
                "name": self._descriptions[stage_id][0],
                "description": self._descriptions[stage_id][1]
            }
            for stage_id in self._parsers_by_stage
        ]

checkpoint_registry = CheckpointRegistry()
