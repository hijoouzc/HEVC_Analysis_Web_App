import pytest
from app.checkpoints.parsers.partition_parser import partition_parser
from app.storage.trace_reader import TraceReader

def test_partition_parser_from_fixture(sample_trace_file):
    part_event = TraceReader.find_one(sample_trace_file, lambda e: e.get("event") == "CTU_PARTITION")
    assert part_event is not None
    
    checkpoint = partition_parser.parse_event(part_event)
    assert checkpoint.cu_size == 64
    assert checkpoint.total_nodes == 5
    assert checkpoint.leaf_nodes == 4
    assert checkpoint.split_count == 1
    assert checkpoint.max_depth == 1
    
    # Check leaf node properties
    first_leaf = checkpoint.nodes[1]
    assert first_leaf.split is False
    assert first_leaf.width == 32
    assert first_leaf.mode == "INTRA"
    assert first_leaf.intra_dir == 0
    assert first_leaf.qp == 32
