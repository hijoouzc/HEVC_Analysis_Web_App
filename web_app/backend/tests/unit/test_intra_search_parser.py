import pytest
from app.storage.trace_reader import TraceReader
from app.checkpoints.parsers.intra_search_parser import intra_search_parser, get_intra_mode_hevc_info

def test_hevc_intra_metadata_classification():
    cat, name, offset = get_intra_mode_hevc_info(0)
    assert cat == "PLANAR"
    assert name == "Planar"
    assert offset == 0
    
    cat, name, offset = get_intra_mode_hevc_info(1)
    assert cat == "DC"
    assert name == "DC"
    
    cat, name, offset = get_intra_mode_hevc_info(10)
    assert cat == "ANGULAR"
    assert name == "Horizontal"
    assert offset == 0
    
    cat, name, offset = get_intra_mode_hevc_info(26)
    assert cat == "ANGULAR"
    assert name == "Vertical"
    assert offset == 0
    
    cat, name, offset = get_intra_mode_hevc_info(2)
    assert cat == "ANGULAR"
    assert offset == 32

def test_intra_search_parser_parse_and_summary(sample_trace_file):
    raw_events = TraceReader.read_all(sample_trace_file, event_filter="RDO_INTRA_SEARCH")
    parsed_modes = [intra_search_parser.parse_event(e) for e in raw_events]
    
    assert len(parsed_modes) == 35
    ranked_modes = intra_search_parser.enrich_and_rank(parsed_modes)
    assert len(ranked_modes) == 35
    assert ranked_modes[0].rank >= 1
    assert any(m.rank == 1 for m in ranked_modes)
    
    summary = intra_search_parser.compute_summary(ranked_modes)
    assert summary.total_modes == 35
    assert len(summary.modes) == 35
    assert summary.best_cost <= summary.max_cost
    assert summary.best_mode in summary.modes
    assert summary.cu_size == 8

def test_intra_search_parser_empty():
    summary = intra_search_parser.compute_summary([])
    assert summary.total_modes == 0
    assert summary.best_mode == 0
