import json
from pathlib import Path
from typing import Iterator, Callable, Any

class TraceReader:
    """Memory-efficient streaming reader for HEVC trace.jsonl files"""
    
    @staticmethod
    def stream_events(trace_file: Path, event_filter: str | None = None) -> Iterator[dict[str, Any]]:
        if not trace_file.exists():
            return
            
        with open(trace_file, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    obj = json.loads(line_str)
                    if event_filter is None or obj.get("event") == event_filter:
                        yield obj
                except json.JSONDecodeError:
                    continue

    @staticmethod
    def read_all(
        trace_file: Path,
        event_filter: str | None = None,
        limit: int | None = None,
        predicate: Callable[[dict[str, Any]], bool] | None = None
    ) -> list[dict[str, Any]]:
        results = []
        for event in TraceReader.stream_events(trace_file, event_filter):
            if predicate is not None and not predicate(event):
                continue
            results.append(event)
            if limit is not None and len(results) >= limit:
                break
        return results

    @staticmethod
    def count_events(trace_file: Path) -> dict[str, int]:
        counts: dict[str, int] = {}
        if not trace_file.exists():
            return counts
            
        with open(trace_file, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    obj = json.loads(line_str)
                    ev = obj.get("event", "UNKNOWN")
                    counts[ev] = counts.get(ev, 0) + 1
                except json.JSONDecodeError:
                    continue
        return counts

    @staticmethod
    def find_one(trace_file: Path, predicate: Callable[[dict[str, Any]], bool]) -> dict[str, Any] | None:
        for event in TraceReader.stream_events(trace_file):
            if predicate(event):
                return event
        return None

trace_reader = TraceReader()
