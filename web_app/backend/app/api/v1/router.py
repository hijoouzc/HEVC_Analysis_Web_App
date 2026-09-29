from fastapi import APIRouter
from app.api.v1.endpoints import jobs, checkpoints

api_v1_router = APIRouter()

api_v1_router.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
api_v1_router.include_router(checkpoints.router, prefix="/checkpoints", tags=["Checkpoints"])
