import shutil
from pathlib import Path
from app.domain.models.roi import ROICoordinates, FrameMetadata
from app.domain.exceptions import EncoderExecutionError

class MockEncoderRunner:
    """Mock runner that copies a predefined trace fixture for lightning-fast testing"""
    
    def __init__(self, fixture_path: Path):
        self.fixture_path = fixture_path
        
    async def run_encode(
        self,
        yuv_input: Path,
        session_dir: Path,
        frame_meta: FrameMetadata,
        roi: ROICoordinates
    ) -> Path:
        if not self.fixture_path.exists():
            raise EncoderExecutionError(f"Fixture trace file not found: {self.fixture_path}")
            
        trace_output = session_dir / "trace.jsonl"
        shutil.copyfile(self.fixture_path, trace_output)
        return trace_output
