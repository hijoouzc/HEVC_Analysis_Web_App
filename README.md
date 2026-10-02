# HEVC Trace-Driven Intra Analysis & Visualization Tool
> **Interactive Data-Flow & Microarchitectural Inspection Platform for ITU-T H.265 / ISO/IEC 23008-2 HEVC (HM-16.0)**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.141-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_19_+_Vite_8-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![HEVC HM](https://img.shields.io/badge/HM_Reference-HM--16.0_C++-00599C.svg?logo=cplusplus&logoColor=white)](https://hevc.hhi.fraunhofer.de)
[![Standard](https://img.shields.io/badge/Standard-ITU--T_H.265_|_ISO/IEC_23008--2-E11D48.svg)](https://www.itu.int/rec/T-REC-H.265)
[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)](LICENSE)

---

## Overview

The **HEVC Trace-Driven Intra Analysis & Visualization Tool** is a research and educational platform that bridges the gap between high-level video coding theory and low-level C++ reference implementations (**HM-16.0**).

Instead of viewing video compression as a black box, this tool instruments the reference software at runtime to capture the exact microarchitectural decisions, mathematical matrices, and spatial predictions inside Coding Tree Units (CTUs), Coding Units (CUs), Prediction Units (PUs), and Transform Units (TUs).

---

## Key Features

### 1. Interactive Full-Frame CTU / CU Partition Navigator (`Frame`)
- **Hierarchical QuadTree Map**: Visualizes the recursive QuadTree partitioning across the entire frame ($64\times 64 \rightarrow 32\times 32 \rightarrow 16\times 16 \rightarrow 8\times 8$).
- **Dual Viewport Switcher**: Toggle between the **pristine original image** (100% natural colors) and the **partition map** overlay with keyboard shortcut `T` or toolbar controls.
- **Direct Spatial Selection**: Click directly on any CTU in the frame to lock focus and navigate seamlessly to intra prediction details.
- **Resolution Modes**: Supports Native Resolution (1080p full-frame, 510 CTUs) and Fast Mode (640×360, 60 CTUs).

### 2. YUV Planar Decomposition Viewer (`YUV Planes`)
- **Tri-Plane Color Space**: Real-time extraction and visualization of Luma ($Y$), Chroma Cb ($U$), and Chroma Cr ($V$) components under 4:2:0 subsampling.
- **False-Color Heatmap & Tint**: Inspect planar values in Monochrome, Tinted, or Turbo Heatmap color schemes.
- **Direct Pixel Inspector**: Inspect synchronized Y, U, and V pixel intensity values at any coordinate.

### 3. Hierarchical QuadTree Partition Visualizer (`QuadTree`)
- **Z-Scan QuadTree Treeview**: Interactive SVG/Canvas view of recursive splits and node coordinates within the active CTU.
- **CU Inspector**: Mode decisions, depth levels, and direct navigation into Intra Prediction.

### 4. Deep Intra Prediction Analysis (`Intra Prediction`)
- **35 HEVC Intra Prediction Modes**: Full inspection of Planar (Mode 0), DC (Mode 1), and 33 Angular Directions (Modes 2–34).
- **Interactive Angular Compass**: 360° directional visualizer displaying intra prediction angles, displacement vectors ($A \cdot d$), and Most Probable Modes (MPM).
- **Reference Sample Substitution & Filtering**: Complete visibility into unfiltered vs filtered reference samples, Mode-Dependent Intra Smoothing (MDIS 3-tap), and Strong Intra Smoothing ($32\times 32$).
- **4-Stage Pipeline Stepper**: Inspect Overview, Stage 1 (Reference Samples), Stage 2 (Angular Projection), Stage 3 (Spatial Synthesis), and Stage 4 (Boundary Filtering & Residual).

### 5. 2D Transform & RDOQ Quantization Engine (`Transform & Quant`)
- **2D DCT-II & 2D DST-VII**: Exact mathematical core transforms for $4\times 4$ intra luma (DST-VII) and $8\times 8$ to $32\times 32$ transform blocks (DCT-II).
- **Frequency Spectrum & Sparsity**: Energy compaction ratio, DC harmonic, zero sparsity ratio, and Coded Block Flags (CBF).

### 6. Four Picture Comparison (`Comparison`)
- **Apple-Inspired Quad View**: Compare Original ($S$), Prediction ($P$), Residual ($R = S - P$), and Reconstructed ($S' = P + R'$).
- **Interactive Split Wipe Slider**: Drag-to-compare wipe slider between any two pictures.
- **Residual Gain Booster**: $1\times, 2\times, 4\times, 8\times$ error gain multipliers for subtle residual inspection.

### 7. Synchronized 4-Way Viewport (`4-Way View`)
- **Synchronized Pixel Inspector**: Click any pixel to immediately inspect aligned values across Original, Prediction, Residual Heatmap, and Reconstructed matrices.
- **Multi-Layout Flexibility**: Switch between 2×2 Grid and 4-Column Side-by-Side views across $Y$, $Cb$, and $Cr$ channels.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   React 19 + Vite Frontend                      │
│   (Apple Minimalist Design, Zero Clutter, Responsive Canvas)     │
└───────────────────────────────▲──────────────────────────────────┘
                                │ HTTP / REST JSON
┌───────────────────────────────▼──────────────────────────────────┐
│                     FastAPI Python Backend                       │
│  • Job Manager & Session Isolation (UUID Workspace)              │
│  • Checkpoint Parsing Pipeline (Partitions, Intra, Transforms)   │
│  • FFmpeg Native YUV420p Color Conversion & Scaling Adapter       │
└───────────────────────────────▲──────────────────────────────────┘
                                │ Subprocess Execution + Trace Pipes
┌───────────────────────────────▼──────────────────────────────────┐
│                 HM-16.0 Reference Software (C++)                 │
│  • VisualDumper Instrumentation Hooks in TEncCu, TEncSearch,      │
│    and TComTrQuant                                               │
│  • Emits per-CU structured JSONL traces at encode time           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Quick Start (One-Click Launch)

A unified startup script is provided to automate environment initialization, dependency installation, encoder detection/auto-compilation, and service startup:

```bash
# Clone the repository
git clone https://github.com/hijoouzc/HEVC_Analysis_Web.git
cd HEVC_Analysis_Web

# Run the unified launcher
./run_tool.sh
```

The script will:
1. Verify system prerequisites (`python3`, `npm`, `ffmpeg`).
2. Detect the compiled HM-16.0 `TAppEncoder` binary (or auto-build it if missing).
3. Initialize the Python virtual environment (`web_app/backend/venv`) and install `requirements.txt`.
4. Install frontend Node modules (`web_app/frontend/node_modules`).
5. Launch the FastAPI backend on `http://localhost:8000`.
6. Launch the React Vite frontend on `http://localhost:5173`.

Access the application in your browser:
- **Web Application**: `http://localhost:5173`
- **Interactive API Docs (Swagger)**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

---

## Manual Setup & Build Guide

### Prerequisites
- **Linux** (Ubuntu 20.04/22.04/24.04 recommended) or macOS
- **GCC / G++ 11+** with C++11/C++14 support
- **CMake 3.16+** and `make`
- **Python 3.10+** (Python 3.12 recommended)
- **Node.js 18+** and `npm`
- **FFmpeg** (installed and available in `PATH`)

**One-line installation on Ubuntu / Debian**:
```bash
sudo apt-get update && sudo apt-get install -y build-essential cmake ffmpeg python3-venv nodejs npm
```

### 1. Build HM-16.0 Encoder with Visual Instrumentation
```bash
# Build optimized Release binary (recommended)
make TAppEncoder-r -j$(nproc)

# Or build Debug binary:
make TAppEncoder-d -j$(nproc)
```
The compiled binary will be placed at:
`bin/umake/gcc-*/x86_64/release/TAppEncoder` (or detected dynamically under `bin/`).

### 2. Backend Setup
```bash
cd web_app/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run automated test suite (25 tests)
pytest -v

# Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd web_app/frontend

# Install dependencies
npm install

# Run linter
npm run lint

# Start development server
npm run dev -- --host 0.0.0.0 --port 5173
```

---

## Project Structure

```
HEVC_reference_software/
├── bin/                          # Compiled HM executables (TAppEncoder, etc.)
├── build/                        # Build files and Makefiles
├── cfg/                          # HM encoder configuration profiles
├── doc/                          # HM reference software documentation
├── docs/                         # Technical documentation & architecture diagrams
│   └── images/                   # Documentation figures
├── source/                       # HM-16.0 C++ Source Code
│   ├── App/                      # Application wrappers (TAppEncoder, TAppDecoder)
│   └── Lib/                      # Core libraries (TLibCommon, TLibEncoder, TLibDecoder)
│       ├── TLibCommon/
│       │   ├── VisualDumper.h    # C++ Visual Instrumentation Header
│       │   ├── VisualDumper.cpp  # Trace serialization engine
│       │   └── TComTrQuant.cpp   # Transform & Quantization dumper hook
│       └── TLibEncoder/
│           ├── TEncCu.cpp        # QuadTree partition dumper hook
│           └── TEncSearch.cpp    # Intra prediction search & reference hooks
├── web_app/                      # Fullstack Analysis Platform
│   ├── backend/                  # FastAPI Application
│   │   ├── app/                  # Application core, API routers, parsers, engine
│   │   ├── tests/                # Unit & Integration test suite (25 tests)
│   │   └── requirements.txt      # Python dependencies
│   └── frontend/                 # React 19 + Vite Application
│       ├── src/
│       │   ├── components/       # UI Viewports, FullFrameViewer, QuadTree, Compass
│       │   └── utils/            # HEVC Color utilities & trace mappers
│       └── package.json          # Node dependencies
├── workspace/                    # Transient encoding sessions & workspace
├── run_tool.sh                   # Unified launcher script
├── intra_prediciton.md           # In-depth technical specification (Vietnamese)
└── README.md                     # Project documentation
```

---

## Technical Terminology & Standards

This project strictly adheres to ITU-T H.265 / ISO/IEC 23008-2 definitions:
- **CTU (Coding Tree Unit)**: Standard $64\times 64$ root processing block.
- **CU (Coding Unit)**: Recursive QuadTree leaf nodes ($64\times 64$, $32\times 32$, $16\times 16$, $8\times 8$).
- **PU (Prediction Unit)**: Carries intra prediction modes and angular directions.
- **TU (Transform Unit)**: Supports 2D DCT-II and 2D DST-VII transforms.
- **MDIS (Mode-Dependent Intra Smoothing)**: 3-tap reference sample filtering.
- **RDOQ (Rate-Distortion Optimized Quantization)**: Optimal level decision based on Lagrangian cost.

---

## Original Reference Software Notice

This software is built on the ITU-T / ISO/IEC Joint Collaborative Team on Video Coding (JCT-VC) **HM (HEVC Test Model)** reference software version 16.0.
For information on the reference software, consult `doc/` and the official JVET software repository.

---

## License

This software package is distributed under the **BSD 3-Clause License**. See the `LICENSE` file for details.
