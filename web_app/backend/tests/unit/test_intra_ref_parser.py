import pytest
from app.checkpoints.parsers.intra_ref_parser import intra_ref_parser
from app.storage.trace_reader import TraceReader

def test_intra_ref_parser_from_fixture(sample_trace_file):
    ref_event = TraceReader.find_one(sample_trace_file, lambda e: e.get("event") == "INTRA_REF_SAMPLES")
    assert ref_event is not None
    
    parsed = intra_ref_parser.parse_event(ref_event)
    assert parsed.cu_size == 8
    assert parsed.luma_ref_count == 17
    assert len(parsed.ref_unfilt_top) == 17
    assert len(parsed.ref_filt_top) == 17
    assert len(parsed.ref_unfilt_top_u) == 9

def test_intra_ref_parser_diff_calculation():
    raw_data = {
        "poc": 0, "ctu_x": 0, "ctu_y": 0, "cu_size": 4,
        "event": "INTRA_REF_SAMPLES",
        "strong_smoothing": False,
        "ref_unfilt_top": [100, 110, 120, 130, 140, 150, 160, 170, 180],
        "ref_unfilt_left": [100, 110, 120, 130, 140, 150, 160, 170, 180],
        "ref_filt_top": [100, 108, 118, 128, 138, 148, 158, 168, 180],
        "ref_filt_left": [100, 110, 120, 130, 140, 150, 160, 170, 180]
    }
    parsed = intra_ref_parser.parse_event(raw_data)
    assert parsed.filter_applied is True
    assert parsed.max_filter_diff == 2
    assert parsed.avg_filter_diff > 0.0
