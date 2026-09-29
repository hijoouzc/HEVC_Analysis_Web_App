import asyncio
from datetime import datetime, timezone
from app.domain.models.job import JobInfo, get_utc_now_iso
from app.domain.models.roi import ROICoordinates, FrameMetadata
from app.domain.enums import JobStatus
from app.domain.exceptions import JobNotFoundError
from app.storage.session_manager import session_manager

class JobManager:
    """Manages life-cycle, status, and metadata of analysis jobs"""
    
    def __init__(self):
        self._jobs: dict[str, JobInfo] = {}
        self._lock = asyncio.Lock()
        
    async def create_job(self, roi: ROICoordinates, frame: FrameMetadata, job_id: str | None = None) -> JobInfo:
        async with self._lock:
            job_id = session_manager.create_session(job_id)
            job = JobInfo(
                job_id=job_id,
                status=JobStatus.PENDING,
                roi=roi,
                frame=frame
            )
            self._jobs[job_id] = job
            return job

    async def get_job(self, job_id: str) -> JobInfo:
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise JobNotFoundError(job_id)
            return job

    async def update_status(self, job_id: str, status: JobStatus, error_message: str | None = None):
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise JobNotFoundError(job_id)
            job.status = status
            job.updated_at = get_utc_now_iso()
            if error_message:
                job.error_message = error_message

    async def set_result(self, job_id: str, best_mode: int, best_cost: float, stages: list[str]):
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise JobNotFoundError(job_id)
            job.status = JobStatus.COMPLETED
            job.best_mode = best_mode
            job.best_cost = best_cost
            job.stages_available = stages
            job.updated_at = get_utc_now_iso()

    async def list_jobs(self) -> list[JobInfo]:
        async with self._lock:
            return list(self._jobs.values())

job_manager = JobManager()
