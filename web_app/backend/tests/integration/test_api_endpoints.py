import pytest
from app.services.analysis_service import analysis_service
from app.engine.mock_runner import MockEncoderRunner

def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "version" in data

def test_list_checkpoint_stages(client):
    res = client.get("/api/v1/checkpoints/stages")
    assert res.status_code == 200
    stages = res.json()
    assert isinstance(stages, list)
    stage_ids = [s["stage_id"] for s in stages]
    assert "CP_01_PARTITION" in stage_ids
    assert "CP_02_INTRA_REF" in stage_ids
    assert "CP_03_INTRA_SEARCH" in stage_ids
    assert "CP_06_TRANSFORM" in stage_ids
    assert "CP_07_QUANT" in stage_ids

def test_legacy_upload_compatibility(client, dummy_png_bytes, sample_trace_file, monkeypatch):
    mock_runner = MockEncoderRunner(fixture_path=sample_trace_file)
    monkeypatch.setattr(analysis_service, "encoder_runner", mock_runner)
    
    files = {"file": ("test.png", dummy_png_bytes, "image/png")}
    data = {"ctu_x": "0", "ctu_y": "0"}
    
    res = client.post("/upload", files=files, data=data)
    assert res.status_code == 200
    json_data = res.json()
    
    assert json_data["status"] == "success"
    assert len(json_data["data"]) == 35
    assert json_data["width"] == 128
    assert json_data["height"] == 128
    assert json_data["ctu_x"] == 0
    assert json_data["ctu_y"] == 0
    assert "best_mode" in json_data
    assert "best_cost" in json_data

def test_modern_job_and_checkpoint_api(client, dummy_png_bytes, sample_trace_file, monkeypatch):
    mock_runner = MockEncoderRunner(fixture_path=sample_trace_file)
    monkeypatch.setattr(analysis_service, "encoder_runner", mock_runner)
    
    # 1. Submit Job
    files = {"file": ("test.png", dummy_png_bytes, "image/png")}
    data = {"ctu_x": "0", "ctu_y": "0", "cu_size": "8"}
    
    submit_res = client.post("/api/v1/jobs/submit", files=files, data=data)
    assert submit_res.status_code == 202
    job_info = submit_res.json()
    job_id = job_info["job_id"]
    assert job_id is not None
    
    # 2. Check Job Status
    get_res = client.get(f"/api/v1/jobs/{job_id}")
    assert get_res.status_code == 200
    assert get_res.json()["job_id"] == job_id
    
    # 3. Check CP_02_INTRA_REF
    ref_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_02_INTRA_REF")
    assert ref_res.status_code == 200
    ref_data = ref_res.json()
    assert "ref_unfilt_top" in ref_data
    assert "ref_filt_top" in ref_data
    assert len(ref_data["ref_unfilt_top"]) == 17
    
    # 4. Get Checkpoint Summary (Lightweight)
    sum_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_03_INTRA_SEARCH/summary")
    assert sum_res.status_code == 200
    summary = sum_res.json()
    assert summary["total_modes"] == 35
    assert "best_mode" in summary
    assert "best_cost" in summary
    
    # 5. Lazy-load modes (Full vs filtered)
    modes_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_03_INTRA_SEARCH")
    assert modes_res.status_code == 200
    modes_list = modes_res.json()
    assert len(modes_list) == 35
    # Verify enriched metadata
    assert "direction_name" in modes_list[0]
    assert "category" in modes_list[0]
    assert "rank" in modes_list[0]
    
    single_mode_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_03_INTRA_SEARCH?mode=0")
    assert single_mode_res.status_code == 200
    single_list = single_mode_res.json()
    assert len(single_list) == 1
    assert single_list[0]["mode"] == 0
    assert single_list[0]["direction_name"] == "Planar"
    
    # 6. Compare mode 0 vs mode 1
    cmp_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_03_INTRA_SEARCH/compare?mode_a=0&mode_b=1")
    assert cmp_res.status_code == 200
    cmp_data = cmp_res.json()
    assert cmp_data["mode_a"] == 0
    assert cmp_data["mode_b"] == 1
    assert "pixel_sad_diff" in cmp_data
    assert len(cmp_data["pixel_diff_matrix"]) == 64

    # 7. Check CP_01_PARTITION
    part_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_01_PARTITION")
    assert part_res.status_code == 200
    part_data = part_res.json()
    assert "nodes" in part_data
    assert part_data["total_nodes"] == 5
    assert part_data["max_depth"] == 1
    assert part_data["cu_size"] == 64
    assert part_data["nodes"][0]["split"] is True

    # 8. Check CP_06_TRANSFORM
    tr_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_06_TRANSFORM?component=Y")
    assert tr_res.status_code == 200
    tr_list = tr_res.json()
    assert len(tr_list) >= 1
    tr_item = tr_list[0]
    assert len(tr_item["resi_matrix"]) == 64
    assert len(tr_item["dct_coeff"]) == 64
    assert "energy_compaction_ratio" in tr_item
    assert tr_item["component"] == "Y"

    # 9. Check CP_07_QUANT
    q_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_07_QUANT?component=Y")
    assert q_res.status_code == 200
    q_list = q_res.json()
    assert len(q_list) >= 1
    q_item = q_list[0]
    assert len(q_item["quant_coeff"]) == 64
    assert "sparsity_ratio" in q_item
    assert q_item["sparsity_ratio"] >= 0.0

