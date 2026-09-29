from pydantic import BaseModel, Field

class ROICoordinates(BaseModel):
    poc: int = Field(default=0, ge=0, description="Picture Order Count")
    ctu_x: int = Field(default=0, ge=0, description="CTU X index (0-based)")
    ctu_y: int = Field(default=0, ge=0, description="CTU Y index (0-based)")
    cu_size: int = Field(default=8, description="Target CU Size (e.g. 64, 32, 16, 8)")

class FrameMetadata(BaseModel):
    width: int = Field(..., gt=0, description="Original image width")
    height: int = Field(..., gt=0, description="Original image height")
    aligned_width: int = Field(..., gt=0, description="Aligned width covering target CTU")
    aligned_height: int = Field(..., gt=0, description="Aligned height covering target CTU")
    max_ctu_x: int = Field(..., ge=0)
    max_ctu_y: int = Field(..., ge=0)
    ctu_size: int = Field(default=64)
    chroma_format: str = Field(default="420")
