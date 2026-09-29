import os
import shutil
import uuid
from pathlib import Path
from app.core.config import settings
from app.domain.exceptions import JobNotFoundError

class SessionManager:
    def __init__(self, base_sessions_dir: Path | None = None):
        self.base_dir = (base_sessions_dir or settings.SESSIONS_DIR).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        
    def create_session(self, job_id: str | None = None) -> str:
        job_id = job_id or uuid.uuid4().hex[:12]
        session_dir = self.base_dir / job_id
        session_dir.mkdir(parents=True, exist_ok=True)
        return job_id
        
    def get_session_dir(self, job_id: str) -> Path:
        session_dir = self.base_dir / job_id
        if not session_dir.exists():
            raise JobNotFoundError(job_id)
        return session_dir
        
    def get_input_image_path(self, job_id: str) -> Path:
        return self.get_session_dir(job_id) / "input_image.png"
        
    def get_yuv_path(self, job_id: str) -> Path:
        return self.get_session_dir(job_id) / "input.yuv"
        
    def get_trace_path(self, job_id: str) -> Path:
        return self.get_session_dir(job_id) / "trace.jsonl"
        
    def get_meta_path(self, job_id: str) -> Path:
        return self.get_session_dir(job_id) / "meta.json"
        
    def cleanup_session(self, job_id: str) -> None:
        session_dir = self.base_dir / job_id
        if session_dir.exists():
            shutil.rmtree(session_dir, ignore_errors=True)

session_manager = SessionManager()
