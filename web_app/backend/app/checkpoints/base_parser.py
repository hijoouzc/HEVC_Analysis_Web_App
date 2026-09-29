from abc import ABC, abstractmethod
from typing import Any

class BaseCheckpointParser(ABC):
    @property
    @abstractmethod
    def stage_id(self) -> str:
        """The canonical stage ID, e.g. CP_03_INTRA_SEARCH"""
        pass
        
    @property
    @abstractmethod
    def event_name(self) -> str:
        """The raw event name in trace.jsonl, e.g. RDO_INTRA_SEARCH"""
        pass
        
    @abstractmethod
    def parse_event(self, raw_data: dict[str, Any]) -> Any:
        """Parses a single JSONL event into a strongly-typed model"""
        pass
        
    def can_parse(self, raw_data: dict[str, Any]) -> bool:
        return raw_data.get("event") == self.event_name
