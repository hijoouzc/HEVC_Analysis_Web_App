from typing import Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from app.domain.enums import JobStatus
from app.domain.models.roi import ROICoordinates, FrameMetadata

def get_utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

class JobInfo(BaseModel):
    job_id: str
    status: JobStatus = JobStatus.PENDING
    created_at: str = Field(default_factory=get_utc_now_iso)
    updated_at: str = Field(default_factory=get_utc_now_iso)
    
    roi: ROICoordinates
    frame: FrameMetadata
    
    best_mode: int | None = None
    best_cost: float | None = None
    error_message: str | None = None
    stages_available: list[str] = Field(default_factory=list)

class LegacyAnalysisResponse(BaseModel):
    status: str
    job_id: str | None = None
    data: list[dict] = Field(default_factory=list)
    width: int
    height: int
    ctu_x: int
    ctu_y: int
    best_mode: int
    best_cost: float
    ref_samples: dict[str, Any] | None = None
    message: str | None = None

