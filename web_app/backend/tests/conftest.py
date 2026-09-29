import pytest
import io
import shutil
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.storage.session_manager import SessionManager
from app.engine.mock_runner import MockEncoderRunner
from app.services.analysis_service import AnalysisService

@pytest.fixture
def test_fixtures_dir() -> Path:
    return Path(__file__).parent / "fixtures"

@pytest.fixture
def sample_trace_file(test_fixtures_dir: Path) -> Path:
    return test_fixtures_dir / "sample_trace.jsonl"

@pytest.fixture
def temp_session_dir(tmp_path: Path) -> Path:
    session_dir = tmp_path / "test_sessions"
    session_dir.mkdir(parents=True, exist_ok=True)
    return session_dir

@pytest.fixture
def temp_session_manager(temp_session_dir: Path) -> SessionManager:
    return SessionManager(base_sessions_dir=temp_session_dir)

@pytest.fixture
def mock_runner(sample_trace_file: Path) -> MockEncoderRunner:
    return MockEncoderRunner(fixture_path=sample_trace_file)

@pytest.fixture
def client() -> TestClient:
    return TestClient(app)

@pytest.fixture
def dummy_png_bytes() -> bytes:
    """Generates a simple 128x128 solid PNG in memory"""
    img = Image.new("RGB", (128, 128), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
