import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from PIL import Image
from app.domain.models.job import JobInfo
from app.domain.models.roi import ROICoordinates, FrameMetadata
from app.domain.exceptions import JobNotFoundError, HEVCAnalysisError
from app.services.job_manager import job_manager
from app.services.analysis_service import analysis_service
from app.storage.session_manager import session_manager
from app.core.config import settings

router = APIRouter()

@router.post("/submit", response_model=JobInfo, status_code=202)
async def submit_analysis_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    ctu_x: int = Form(0),
    ctu_y: int = Form(0),
    cu_size: int = Form(8),
    scale_mode: str = Form("native")
):
    try:
        content = await file.read()
        job_id = session_manager.create_session()
        input_image = session_manager.get_input_image_path(job_id)
        
        with open(input_image, "wb") as f:
            f.write(content)
            
        with Image.open(input_image) as img:
            orig_w, orig_h = img.size
            
        ctu_size = settings.CTU_SIZE
        if scale_mode == "fast":
            target_max_w = 640
            target_max_h = 360
            if orig_w > target_max_w or orig_h > target_max_h:
                scale = min(target_max_w / orig_w, target_max_h / orig_h)
                calc_w = max(64, int(orig_w * scale))
                calc_h = max(64, int(orig_h * scale))
            else:
                calc_w = orig_w
                calc_h = orig_h
        else:
            calc_w = orig_w
            calc_h = orig_h

        calc_w = max(64, round(calc_w / 8) * 8)
        calc_h = max(64, round(calc_h / 8) * 8)

        num_ctu_w = (calc_w + ctu_size - 1) // ctu_size
        num_ctu_h = (calc_h + ctu_size - 1) // ctu_size

        roi = ROICoordinates(
            ctu_x=min(ctu_x, max(0, num_ctu_w - 1)),
            ctu_y=min(ctu_y, max(0, num_ctu_h - 1)),
            cu_size=cu_size
        )
        frame_meta = FrameMetadata(
            width=calc_w,
            height=calc_h,
            aligned_width=calc_w,
            aligned_height=calc_h,
            max_ctu_x=max(0, num_ctu_w - 1),
            max_ctu_y=max(0, num_ctu_h - 1),
            ctu_size=ctu_size
        )
        
        job_info = await job_manager.create_job(roi=roi, frame=frame_meta, job_id=job_id)
        
        # Enqueue pipeline execution in background
        background_tasks.add_task(
            analysis_service.execute_analysis_pipeline,
            job_id=job_id,
            input_image_path=input_image,
            roi=roi,
            scale_mode=scale_mode
        )
        
        return job_info
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{job_id}", response_model=JobInfo)
async def get_job_status(job_id: str):
    try:
        return await job_manager.get_job(job_id)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

@router.get("", response_model=list[JobInfo])
async def list_jobs():
    return await job_manager.list_jobs()
