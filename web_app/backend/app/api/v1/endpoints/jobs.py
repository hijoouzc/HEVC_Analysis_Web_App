import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from PIL import Image, ImageChops
from app.domain.models.job import JobInfo
from app.domain.models.roi import ROICoordinates, FrameMetadata
from app.domain.exceptions import JobNotFoundError, HEVCAnalysisError
from app.services.job_manager import job_manager
from app.services.analysis_service import analysis_service
from app.storage.session_manager import session_manager
from app.engine.ffmpeg_adapter import ffmpeg_adapter
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
        calc_w, calc_h = analysis_service.compute_frame_dimensions(orig_w, orig_h, scale_mode)

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

@router.get("/{job_id}/images/{image_type}")
async def get_job_image(job_id: str, image_type: str, gain: int = 4):
    """
    Serves generated images for an analysis job:
    image_type: 'original', 'reconstructed', 'residual', 'y', 'u', 'v'
    """
    try:
        session_dir = session_manager.get_session_dir(job_id)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    input_img = session_manager.get_input_image_path(job_id)
    if not input_img.exists():
        raise HTTPException(status_code=404, detail="Input image not found for this job.")

    # Read image dimensions for YUV operations
    with Image.open(input_img) as img:
        img_w, img_h = img.size

    norm_type = image_type.lower().strip()

    if norm_type == "original":
        return FileResponse(input_img, media_type="image/png")

    recon_png = session_manager.get_recon_image_path(job_id)
    recon_yuv = session_manager.get_recon_yuv_path(job_id)

    if norm_type == "reconstructed":
        if recon_png.exists():
            return FileResponse(recon_png, media_type="image/png")
        if recon_yuv.exists():
            await ffmpeg_adapter.convert_yuv_to_png(recon_yuv, recon_png, img_w, img_h)
            if recon_png.exists():
                return FileResponse(recon_png, media_type="image/png")
        # Fallback to original if reconstructed is not yet generated
        return FileResponse(input_img, media_type="image/png")

    if norm_type == "residual":
        residual_png = session_dir / f"residual_gain{gain}.png"
        if residual_png.exists():
            return FileResponse(residual_png, media_type="image/png")

        # Ensure we have recon_png
        if not recon_png.exists() and recon_yuv.exists():
            await ffmpeg_adapter.convert_yuv_to_png(recon_yuv, recon_png, img_w, img_h)

        if recon_png.exists():
            orig = Image.open(input_img).convert("RGB")
            recon = Image.open(recon_png).convert("RGB")
            if orig.size != recon.size:
                recon = recon.resize(orig.size)
            diff = ImageChops.difference(orig, recon)
            if gain != 1:
                diff = diff.point(lambda p: min(255, p * gain))
            diff.save(residual_png)
            return FileResponse(residual_png, media_type="image/png")
        else:
            # Fallback zero-residual image
            empty = Image.new("RGB", (img_w, img_h), (0, 0, 0))
            empty.save(residual_png)
            return FileResponse(residual_png, media_type="image/png")

    if norm_type in ["y", "u", "v"]:
        plane_png = session_dir / f"plane_{norm_type}.png"
        if plane_png.exists():
            return FileResponse(plane_png, media_type="image/png")

        input_yuv = session_manager.get_yuv_path(job_id)
        if input_yuv.exists():
            planes = await ffmpeg_adapter.extract_yuv_planes(input_yuv, session_dir, img_w, img_h)
            if norm_type in planes and planes[norm_type].exists():
                return FileResponse(planes[norm_type], media_type="image/png")

        # Fallback plane generation via PIL native YCbCr split
        img_ycbcr = Image.open(input_img).convert("YCbCr")
        y_plane, cb_plane, cr_plane = img_ycbcr.split()
        if norm_type == "y":
            y_plane.save(plane_png)
        elif norm_type == "u":
            cb_plane.save(plane_png)
        else:
            cr_plane.save(plane_png)
        return FileResponse(plane_png, media_type="image/png")

    raise HTTPException(status_code=400, detail=f"Unsupported image type: {image_type}")

@router.get("", response_model=list[JobInfo])
async def list_jobs():
    return await job_manager.list_jobs()
