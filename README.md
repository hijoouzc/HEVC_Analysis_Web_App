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

### 1. Interactive Full-Frame CTU / CU Partition Navigator
- **Hierarchical QuadTree Map**: Visualizes the recursive QuadTree partitioning across the entire frame ($64\times 64 \rightarrow 32\times 32 \rightarrow 16\times 16 \rightarrow 8\times 8$).
- **Dual Viewport Switcher**: Toggle between the **pristine original image** (100% natural colors) and the **partition map** overlay with keyboard shortcut `T` or toolbar controls.
- **Direct Spatial Selection**: Click directly on any CTU in the frame to lock focus and navigate seamlessly to intra prediction details.
- **Resolution Modes**: Supports Native Resolution (1080p full-frame, 510 CTUs) and Fast Mode (640×360, 60 CTUs).

### 2. Deep Intra Prediction Analysis (ITU-T H.265 Standard)
- **35 HEVC Intra Prediction Modes**: Full inspection of Planar (Mode 0), DC (Mode 1), and 33 Angular Directions (Modes 2–34).
- **Interactive Angular Compass**: 360° directional visualizer displaying intra prediction angles, displacement vectors ($A \cdot d$), and Most Probable Modes (MPM).
- **Reference Sample Substitution & Filtering**: Complete visibility into unfiltered vs filtered reference samples, Mode-Dependent Intra Smoothing (MDIS 3-tap), and Strong Intra Smoothing ($32\times 32$).
- **Chroma Subsampling (4:2:0)**: Side-by-side inspection of Luma ($Y$) and Chroma ($Cb, Cr$) components.

### 3. Synchronized 4-Way Viewport
- **Quad View Comparison**: Side-by-side synchronized comparison of:
  1. **Original Block**: Raw input pixel samples.
  2. **Prediction Block**: Synthesized prediction from the selected intra mode.
  3. **Residual Heatmap**: Bipolar error visualization (Zero = neutral, Positive = Red, Negative = Blue).
  4. **Reconstructed Block**: Post-transform and dequantized output block.

### 4. 2D Transform & Quantization Engine
- **2D DCT-II & 2D DST-VII**: Exact mathematical core transforms for $4\times 4$ intra luma and $8\times 8$ to $32\times 32$ transform blocks.
- **RDOQ Quantization Matrix**: Direct coefficient table inspections, Coded Block Flags (CBF), and Rate-Distortion Optimization (RDO) costs.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   React 19 + Vite Frontend                      │
│   (Swiss Minimalist Design, Zero Icon Clutter, Responsive Canvas) │
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

A unified startup script is provided to automate environment initialization, dependency installation, and service startup:

```bash
# Clone the repository
git clone https://github.com/hijoouzc/HEVC_reference_software.git
cd HEVC_reference_software

# Run the unified launcher
./run_tool.sh
```

The script will:
1. Detect and verify the compiled HM-16.0 `TAppEncoder` binary.
2. Initialize the Python virtual environment (`web_app/backend/venv`) and install `requirements.txt`.
3. Install frontend Node modules (`web_app/frontend/node_modules`).
4. Launch the FastAPI backend on `http://localhost:8000`.
5. Launch the React Vite frontend on `http://localhost:5173`.

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

### 1. Build HM-16.0 Encoder with Visual Instrumentation
```bash
# Build using the root makefile
make TAppEncoder-d -j$(nproc)
```
The compiled binary will be placed at:
`bin/umake/gcc-13.3/x86_64/debug/TAppEncoder` (or detected dynamically under `bin/`).

### 2. Backend Setup
```bash
cd web_app/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run automated test suite
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
│   │   ├── tests/                # Unit & Integration test suite (24 tests)
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
