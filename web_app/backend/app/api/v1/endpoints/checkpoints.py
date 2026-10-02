from fastapi import APIRouter, HTTPException, Query
from app.domain.models.checkpoint import (
    IntraModeData,
    IntraSearchSummary,
    IntraRefCheckpoint,
    IntraComparisonResult,
    CTUPartitionCheckpoint,
    TransformQuantCheckpoint
)
from app.domain.exceptions import JobNotFoundError, InvalidInputError
from app.services.analysis_service import analysis_service
from app.checkpoints.registry import checkpoint_registry

router = APIRouter()

@router.get("/stages")
async def list_registered_stages():
    """Returns all HEVC checkpoint stages supported by the platform"""
    return checkpoint_registry.list_available_stages()

@router.get("/{job_id}/stages")
async def get_job_stages(job_id: str):
    """Returns available stages for a specific job"""
    try:
        from app.services.job_manager import job_manager
        job = await job_manager.get_job(job_id)
        return {
            "job_id": job_id,
            "status": job.status,
            "stages_available": job.stages_available
        }
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

# ==========================================
# CP_01_PARTITION Endpoints
# ==========================================
@router.get("/{job_id}/CP_01_PARTITION", response_model=CTUPartitionCheckpoint)
async def get_partition_tree(job_id: str):
    """CP_01_PARTITION: Retrieves the complete CTU QuadTree partition tree (depths 0-3)"""
    try:
        return analysis_service.get_partition_data(job_id)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{job_id}/partitions", response_model=list[CTUPartitionCheckpoint])
async def get_all_partitions(job_id: str):
    """Retrieves all CTU QuadTree partition trees available in the trace"""
    try:
        return analysis_service.get_all_partitions(job_id)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==========================================
# CP_02_INTRA_REF Endpoints
# ==========================================
@router.get("/{job_id}/CP_02_INTRA_REF", response_model=IntraRefCheckpoint)
async def get_intra_ref_checkpoint(
    job_id: str,
    cu_size: int | None = Query(None, description="Optional target CU block size (4, 8, 16, 32, 64)")
):
    """CP_02_INTRA_REF: Retrieves raw and filtered reference samples (4N+1)"""
    try:
        return analysis_service.get_intra_ref_data(job_id, cu_size=cu_size)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==========================================
# CP_03_INTRA_SEARCH Endpoints
# ==========================================
@router.get("/{job_id}/CP_03_INTRA_SEARCH/summary", response_model=IntraSearchSummary)
async def get_intra_search_summary(job_id: str):
    """Lightweight endpoint returning high-level intra prediction summary (<1 KB)"""
    try:
        return analysis_service.get_intra_search_summary(job_id)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{job_id}/CP_03_INTRA_SEARCH/compare", response_model=IntraComparisonResult)
async def compare_intra_candidates(
    job_id: str,
    mode_a: int = Query(..., ge=0, le=34, description="First candidate mode index"),
    mode_b: int = Query(..., ge=0, le=34, description="Second candidate mode index"),
    cu_size: int | None = Query(None, description="Optional CU block size (4, 8, 16, 32, 64)")
):
    """Computes pixel-by-pixel differential prediction and cost comparison between two Intra modes"""
    try:
        return analysis_service.compare_intra_modes(job_id, mode_a=mode_a, mode_b=mode_b, cu_size=cu_size)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    except InvalidInputError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{job_id}/CP_03_INTRA_SEARCH", response_model=list[IntraModeData])
async def get_intra_search_modes(
    job_id: str,
    mode: int | None = Query(None, ge=0, le=34, description="Optional filter for a specific mode index (0-34)"),
    cu_size: int | None = Query(None, description="Optional target CU block size (4, 8, 16, 32, 64)")
):
    """Lazy-load full matrix and reference sample data for tested Intra modes"""
    try:
        return analysis_service.get_intra_search_data(job_id, mode=mode, cu_size=cu_size)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==========================================
# CP_06_TRANSFORM & CP_07_QUANT Endpoints
# ==========================================
@router.get("/{job_id}/CP_06_TRANSFORM", response_model=list[TransformQuantCheckpoint])
async def get_transform_checkpoints(
    job_id: str,
    comp: str | None = Query(None, description="Color component ('Y', 'Cb', 'Cr')"),
    component: str | None = Query(None, description="Alias for comp")
):
    """CP_06_TRANSFORM: Retrieves 2D DCT/DST transform coefficients and residual matrix"""
    try:
        active_comp = component or comp
        return analysis_service.get_transform_quant_data(job_id, comp=active_comp)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{job_id}/CP_07_QUANT", response_model=list[TransformQuantCheckpoint])
async def get_quant_checkpoints(
    job_id: str,
    comp: str | None = Query(None, description="Color component ('Y', 'Cb', 'Cr')"),
    component: str | None = Query(None, description="Alias for comp")
):
    """CP_07_QUANT: Retrieves quantized transform coefficients and sparsity statistics"""
    try:
        active_comp = component or comp
        return analysis_service.get_transform_quant_data(job_id, comp=active_comp)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
