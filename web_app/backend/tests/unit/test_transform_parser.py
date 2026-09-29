import pytest
from app.checkpoints.parsers.transform_parser import transform_quant_parser
from app.storage.trace_reader import TraceReader

def test_transform_parser_from_fixture(sample_trace_file):
    tq_event = TraceReader.find_one(sample_trace_file, lambda e: e.get("event") == "TRANSFORM_QUANT")
    assert tq_event is not None
    
    checkpoint = transform_quant_parser.parse_event(tq_event)
    assert checkpoint.width == 8
    assert checkpoint.height == 8
    assert checkpoint.component == "Y"
    assert checkpoint.qp == 32
    assert len(checkpoint.dct_coeff) == 64
    assert len(checkpoint.quant_coeff) == 64
    assert checkpoint.dc_coeff == 320
    assert checkpoint.energy_compaction_ratio > 0.0
    assert checkpoint.sparsity_ratio > 0.90 # high sparsity after quantization
