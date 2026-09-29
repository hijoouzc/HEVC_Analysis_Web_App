import pytest
from pathlib import Path
from app.domain.exceptions import JobNotFoundError

def test_session_manager_create_and_paths(temp_session_manager):
    job_id = temp_session_manager.create_session("job_test_123")
    assert job_id == "job_test_123"
    
    session_dir = temp_session_manager.get_session_dir(job_id)
    assert session_dir.exists()
    assert session_dir.is_dir()
    
    input_img = temp_session_manager.get_input_image_path(job_id)
    assert input_img.name == "input_image.png"
    assert input_img.parent == session_dir
    
    yuv_path = temp_session_manager.get_yuv_path(job_id)
    assert yuv_path.name == "input.yuv"
    
    trace_path = temp_session_manager.get_trace_path(job_id)
    assert trace_path.name == "trace.jsonl"

def test_session_manager_nonexistent_job(temp_session_manager):
    with pytest.raises(JobNotFoundError):
        temp_session_manager.get_session_dir("non_existent_id")

def test_session_manager_cleanup(temp_session_manager):
    job_id = temp_session_manager.create_session("job_to_clean")
    session_dir = temp_session_manager.get_session_dir(job_id)
    assert session_dir.exists()
    
    temp_session_manager.cleanup_session(job_id)
    assert not session_dir.exists()
