import pytest
from app.domain.models.roi import ROICoordinates, FrameMetadata
from app.domain.models.checkpoint import IntraModeData, IntraSearchSummary
from app.domain.enums import StageEnum, JobStatus

def test_roi_coordinates_defaults():
    roi = ROICoordinates()
    assert roi.poc == 0
    assert roi.ctu_x == 0
    assert roi.ctu_y == 0
    assert roi.cu_size == 8

def test_frame_metadata_validation():
    meta = FrameMetadata(
        width=1920,
        height=1080,
        aligned_width=1920,
        aligned_height=1088,
        max_ctu_x=29,
        max_ctu_y=16
    )
    assert meta.width == 1920
    assert meta.ctu_size == 64
    assert meta.chroma_format == "420"

def test_intra_mode_data_parsing():
    sample_dict = {
        "poc": 0,
        "ctu_x": 1,
        "ctu_y": 2,
        "cu_size": 8,
        "event": "RDO_INTRA_SEARCH",
        "mode": 10,
        "cost": 1250.5,
        "org_data": [100] * 64,
        "pred_data": [110] * 64,
        "resi_data": [-10] * 64,
        "ref_top": [100] * 17,
        "ref_left": [100] * 17
    }
    mode_obj = IntraModeData(**sample_dict)
    assert mode_obj.mode == 10
    assert mode_obj.cost == 1250.5
    assert len(mode_obj.org_data) == 64
    assert len(mode_obj.ref_top) == 17
