# HEVC Analysis Tool - Backend API

FastAPI-powered REST API backend that interfaces with the instrumented HM-16.0 reference encoder (`TAppEncoder`), manages transient workspace sessions, and streams structured trace checkpoints for intra prediction analysis.

---

## Prerequisites
- **Python**: 3.10+ (Python 3.12 recommended)
- **FFmpeg**: Required for raw YUV420p video frame conversion
- **Compiled HM Encoder**: `TAppEncoder` executable in `bin/` (build with `make TAppEncoder-r -j$(nproc)` at root)

---

## Setup & Running

### 1. Create Virtual Environment & Install Dependencies
```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Run Test Suite
```bash
pytest -v
```
All 25 integration and unit tests should pass.

### 3. Start Development Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## API Endpoints

Once the server is running, interactive API documentation is available at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Core Endpoints:
- `POST /upload`: Uploads an image frame, executes the HM-16.0 encoder for the target CTU/CU, and returns 35 Intra candidate search results with reference samples.
- `GET /health`: Health status and HM encoder binary path detection.
- `GET /api/v1/jobs/{job_id}/images/{image_type}`: Serves generated image representations:
  - `original`: Pristine PNG frame.
  - `reconstructed`: Post-encoding reconstructed PNG frame.
  - `residual?gain={1|2|4|8}`: Amplified residual difference image.
  - `y`, `u`, `v`: Individual YUV planar channel images.
- `GET /api/v1/checkpoints/{job_id}/{checkpoint_id}`:
  - `CP_01_PARTITION`: CTU recursive QuadTree partition structure.
  - `CP_02_INTRA_REF`: 1D perimeter reference samples (filtered and unfiltered).
  - `CP_03_INTRA_SEARCH`: 35 intra candidate modes with RDO costs.
  - `CP_06_TRANSFORM`: 2D DCT-II / 2D DST-VII frequency spectrum matrices.
  - `CP_07_QUANT`: Quantized levels and sparsity ratios.
