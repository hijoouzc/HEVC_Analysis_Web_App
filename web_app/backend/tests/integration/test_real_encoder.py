import pytest
from app.services.analysis_service import analysis_service
from app.core.config import settings

@pytest.mark.skipif(not settings.ENCODER_BIN.exists(), reason="TAppEncoder binary not found")
def test_real_encoder_end_to_end(client, dummy_png_bytes):
    """End-to-end verification running actual compiled HM C++ encoder"""
    files = {"file": ("test_real.png", dummy_png_bytes, "image/png")}
    data = {"ctu_x": "0", "ctu_y": "0"}
    
    # We call legacy upload which exercises ffmpeg cropping + actual TAppEncoder run + jsonl parsing
    res = client.post("/upload", files=files, data=data)
    assert res.status_code == 200
    
    json_data = res.json()
    assert json_data["status"] == "success"
    assert len(json_data["data"]) >= 35
    assert json_data["ctu_x"] == 0
    assert json_data["ctu_y"] == 0
    assert "best_mode" in json_data
    assert "best_cost" in json_data
    assert json_data["best_cost"] > 0
    
    # Check that individual candidate items have required pixel fields
    first_mode = json_data["data"][0]
    assert "org_data" in first_mode
    assert len(first_mode["org_data"]) == 64 # 8x8 CU
    assert "pred_data" in first_mode
    assert "ref_top" in first_mode
    assert len(first_mode["ref_top"]) == 17 # 2N + 1

@pytest.mark.skipif(not settings.ENCODER_BIN.exists(), reason="TAppEncoder binary not found")
def test_real_encoder_sprint2_checkpoints(client, dummy_png_bytes):
    """Verify that actual HM C++ encoder captures CP_02_INTRA_REF and CP_03_INTRA_SEARCH"""
    files = {"file": ("test_sprint2.png", dummy_png_bytes, "image/png")}
    data = {"ctu_x": "0", "ctu_y": "0", "cu_size": "8"}
    
    submit_res = client.post("/api/v1/jobs/submit", files=files, data=data)
    assert submit_res.status_code == 202
    job_id = submit_res.json()["job_id"]
    
    # Wait for completion (sync check on status)
    import time
    completed = False
    for _ in range(20):
        s_res = client.get(f"/api/v1/jobs/{job_id}")
        if s_res.json()["status"] == "COMPLETED":
            completed = True
            break
        time.sleep(0.2)
        
    assert completed is True
    
    # Verify CP_02_INTRA_REF from real encoder
    ref_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_02_INTRA_REF")
    assert ref_res.status_code == 200
    ref_data = ref_res.json()
    assert "ref_unfilt_top" in ref_data
    assert len(ref_data["ref_unfilt_top"]) == 17
    assert len(ref_data["ref_filt_top"]) == 17
    
    # Verify CP_03_INTRA_SEARCH compare endpoint
    cmp_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_03_INTRA_SEARCH/compare?mode_a=0&mode_b=1")
    assert cmp_res.status_code == 200
    cmp_data = cmp_res.json()
    assert cmp_data["mode_a"] == 0
    assert cmp_data["mode_b"] == 1
    assert "pixel_sad_diff" in cmp_data

@pytest.mark.skipif(not settings.ENCODER_BIN.exists(), reason="TAppEncoder binary not found")
def test_real_encoder_sprint3_checkpoints(client, dummy_png_bytes):
    """Verify that actual HM C++ encoder captures CP_01_PARTITION, CP_06_TRANSFORM, and CP_07_QUANT"""
    files = {"file": ("test_sprint3.png", dummy_png_bytes, "image/png")}
    data = {"ctu_x": "0", "ctu_y": "0", "cu_size": "8"}
    
    submit_res = client.post("/api/v1/jobs/submit", files=files, data=data)
    assert submit_res.status_code == 202
    job_id = submit_res.json()["job_id"]
    
    import time
    completed = False
    for _ in range(20):
        s_res = client.get(f"/api/v1/jobs/{job_id}")
        if s_res.json()["status"] == "COMPLETED":
            completed = True
            break
        time.sleep(0.2)
        
    assert completed is True
    
    # 1. Verify CP_01_PARTITION
    part_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_01_PARTITION")
    assert part_res.status_code == 200
    part_data = part_res.json()
    assert "nodes" in part_data
    assert len(part_data["nodes"]) > 0
    assert part_data["cu_size"] == 64
    root = part_data["nodes"][0]
    assert "depth" in root
    assert "split" in root
    assert "width" in root
    
    # 2. Verify CP_06_TRANSFORM
    tr_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_06_TRANSFORM?component=Y")
    assert tr_res.status_code == 200
    tr_list = tr_res.json()
    assert len(tr_list) > 0
    tr_item = tr_list[0]
    assert "resi_matrix" in tr_item
    assert "dct_coeff" in tr_item
    assert "energy_compaction_ratio" in tr_item
    assert len(tr_item["resi_matrix"]) == 64
    
    # 3. Verify CP_07_QUANT
    q_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_07_QUANT?component=Y")
    assert q_res.status_code == 200
    q_list = q_res.json()
    assert len(q_list) > 0
    q_item = q_list[0]
    assert "quant_coeff" in q_item
    assert "sparsity_ratio" in q_item
    assert "sig_coeff_count" in q_item
    assert len(q_item["quant_coeff"]) == 64


@pytest.mark.skipif(not settings.ENCODER_BIN.exists(), reason="TAppEncoder binary not found")
def test_real_encoder_cu_size_32(client, dummy_png_bytes):
    """Verify that uploading with cu_size=32 extracts 32x32 intra prediction data with Y, U, V"""
    files = {"file": ("test_32.png", dummy_png_bytes, "image/png")}
    data = {"ctu_x": "0", "ctu_y": "0", "cu_size": "32"}
    
    res = client.post("/upload", files=files, data=data)
    assert res.status_code == 200
    json_data = res.json()
    assert json_data["status"] == "success"
    assert len(json_data["data"]) > 0
    first_mode = json_data["data"][0]
    # Luma 32x32 = 1024 samples
    assert len(first_mode["org_data"]) == 1024
    assert len(first_mode["pred_data"]) == 1024
    # Chroma 16x16 = 256 samples
    assert "org_u" in first_mode
    assert len(first_mode["org_u"]) == 256
    assert "org_v" in first_mode
    assert len(first_mode["org_v"]) == 256
    # 2N + 1 ref samples = 65 for 32x32
    assert len(first_mode["ref_top"]) == 65
    assert len(first_mode["ref_left"]) == 65


