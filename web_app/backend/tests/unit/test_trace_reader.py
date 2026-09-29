import pytest
from app.storage.trace_reader import TraceReader

def test_trace_reader_stream(sample_trace_file):
    all_events = list(TraceReader.stream_events(sample_trace_file))
    assert len(all_events) == 38
    
    intra_search_events = list(TraceReader.stream_events(sample_trace_file, event_filter="RDO_INTRA_SEARCH"))
    assert len(intra_search_events) == 35
    assert all(e["event"] == "RDO_INTRA_SEARCH" for e in intra_search_events)
    
    ref_events = list(TraceReader.stream_events(sample_trace_file, event_filter="INTRA_REF_SAMPLES"))
    assert len(ref_events) == 1
    
    part_events = list(TraceReader.stream_events(sample_trace_file, event_filter="CTU_PARTITION"))
    assert len(part_events) == 1
    
    tq_events = list(TraceReader.stream_events(sample_trace_file, event_filter="TRANSFORM_QUANT"))
    assert len(tq_events) == 1

def test_trace_reader_read_all_with_limit(sample_trace_file):
    events = TraceReader.read_all(sample_trace_file, limit=5)
    assert len(events) == 5

def test_trace_reader_count_events(sample_trace_file):
    counts = TraceReader.count_events(sample_trace_file)
    assert counts.get("RDO_INTRA_SEARCH") == 35
    assert counts.get("INTRA_REF_SAMPLES") == 1
    assert counts.get("CTU_PARTITION") == 1
    assert counts.get("TRANSFORM_QUANT") == 1

def test_trace_reader_find_one(sample_trace_file):
    event = TraceReader.find_one(sample_trace_file, lambda e: e.get("mode") == 0)
    assert event is not None
    assert event["mode"] == 0
    assert "cost" in event
    assert "pred_data" in event
