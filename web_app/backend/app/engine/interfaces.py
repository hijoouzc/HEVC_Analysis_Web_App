from typing import Protocol
from pathlib import Path
from app.domain.models.roi import ROICoordinates, FrameMetadata

class IVideoProcessor(Protocol):
    async def process_image_to_yuv(
        self,
        input_image: Path,
        output_yuv: Path,
        roi: ROICoordinates
    ) -> FrameMetadata:
        """Processes input image to pixel-exact YUV 4:2:0 file aligned with CTU grid"""
        ...

class IEncoderRunner(Protocol):
    async def run_encode(
        self,
        yuv_input: Path,
        session_dir: Path,
        frame_meta: FrameMetadata,
        roi: ROICoordinates
    ) -> Path:
        """Executes HEVC reference encoder and returns path to generated trace.jsonl"""
        ...
