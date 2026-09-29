import asyncio
from pathlib import Path
from PIL import Image
from app.domain.models.roi import ROICoordinates, FrameMetadata
from app.domain.exceptions import InvalidInputError, EncoderExecutionError
from app.core.config import settings

class FFmpegAdapter:
    """Handles pixel-exact cropping and YUV420 conversion aligned with CTU 64x64 grid"""
    
    async def process_image_to_yuv(
        self,
        input_image: Path,
        output_yuv: Path,
        roi: ROICoordinates,
        scale_mode: str = "native"
    ) -> FrameMetadata:
        if not input_image.exists():
            raise InvalidInputError(f"Input image not found: {input_image}")
            
        try:
            with Image.open(input_image) as img:
                orig_w, orig_h = img.size
        except Exception as e:
            raise InvalidInputError(f"Failed to parse input image: {e}")
            
        ctu_size = settings.CTU_SIZE

        if scale_mode == "fast":
            # Optional Fast Preview: Scale down frames to max 640x360 (10x6 CTUs) for <3s encode
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
            # Native Resolution: Preserve exact 1:1 image resolution from input
            calc_w = orig_w
            calc_h = orig_h

        # Dimensions must be multiple of 8 (HEVC minCU requirement) and even for YUV 4:2:0
        calc_w = max(64, round(calc_w / 8) * 8)
        calc_h = max(64, round(calc_h / 8) * 8)

        num_ctu_w = (calc_w + ctu_size - 1) // ctu_size
        num_ctu_h = (calc_h + ctu_size - 1) // ctu_size
        max_ctu_x = max(0, num_ctu_w - 1)
        max_ctu_y = max(0, num_ctu_h - 1)
        
        target_ctu_x = min(max(0, roi.ctu_x), max_ctu_x)
        target_ctu_y = min(max(0, roi.ctu_y), max_ctu_y)
        
        # Update ROI in-place with clamped coordinates
        roi.ctu_x = target_ctu_x
        roi.ctu_y = target_ctu_y
        
        output_yuv.parent.mkdir(parents=True, exist_ok=True)
        
        cmd = ["ffmpeg", "-y", "-i", str(input_image)]
        if calc_w != orig_w or calc_h != orig_h:
            cmd.extend(["-vf", f"scale={calc_w}:{calc_h}"])
        cmd.extend(["-pix_fmt", "yuv420p", str(output_yuv)])
        
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()
        
        if proc.returncode != 0:
            err_msg = stderr.decode(errors="replace") if stderr else "Unknown ffmpeg error"
            raise EncoderExecutionError(f"FFmpeg conversion failed: {err_msg}", proc.returncode or -1)
            
        return FrameMetadata(
            width=calc_w,
            height=calc_h,
            aligned_width=calc_w,
            aligned_height=calc_h,
            max_ctu_x=max_ctu_x,
            max_ctu_y=max_ctu_y,
            ctu_size=ctu_size,
            chroma_format="420"
        )

ffmpeg_adapter = FFmpegAdapter()
