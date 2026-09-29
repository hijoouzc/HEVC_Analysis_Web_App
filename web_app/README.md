# HEVC Analysis Tool - Web Application

This directory contains the fullstack web application that interfaces with the instrumented HM-16.0 encoder.

## Structure

- **`backend/`**: FastAPI (Python 3.12) REST API server.
  - Manages asynchronous encoding jobs and workspace sessions.
  - Converts user image uploads to raw YUV420p via FFmpeg.
  - Dispatches `TAppEncoder` with target ROI configuration.
  - Parses JSONL trace streams into strongly-typed Pydantic domain models:
    - Partition trees (`STAGE_01_PARTITION_TREE`)
    - Intra reference samples & MDIS filtering (`STAGE_02_INTRA_REF`)
    - 35 Intra candidate searches & angular evaluations (`STAGE_03_INTRA_SEARCH`)
    - 2D Transform & RDOQ Quantization matrices (`STAGE_04_TRANSFORM_QUANT`)
  - Provides 24 integration and unit tests (`pytest`).

- **`frontend/`**: React 19 + Vite modern web interface.
  - Clean Swiss typography, distraction-free technical design.
  - High-precision SVG/Canvas renderer for full-frame CTU/CU partitions.
  - Real-time toggle between clean original source and partition overlay (Shortcut `T`).
  - Interactive 360° Angular Intra Prediction Compass.
  - Synchronized 4-Way Viewport (Original, Prediction, Residual Heatmap, Reconstructed).
  - 2D Transform and Quantization coefficient inspection tables.

## Development

To run both services together, use the root launcher:
```bash
./run_tool.sh
```

Or run them individually:

### Backend:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pytest -v
uvicorn app.main:app --port 8000 --reload
```

### Frontend:
```bash
cd frontend
npm install
npm run lint
npm run dev
```
