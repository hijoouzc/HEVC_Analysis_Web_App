#!/usr/bin/env bash

# ==============================================================================
# HEVC Trace-Driven Analyzer - Unified Launcher Script
# Starts both FastAPI Backend (port 8000) and React/Vite Frontend (port 5173)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/web_app/backend"
FRONTEND_DIR="$SCRIPT_DIR/web_app/frontend"

echo "------------------------------------------------------------"
echo "  HEVC TRACE-DRIVEN ANALYZER - STARTUP"
echo "------------------------------------------------------------"

# 0. Check system prerequisites
command -v python3 >/dev/null 2>&1 || { echo "[ERROR] python3 is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "[ERROR] npm (Node.js) is required but not installed. Aborting."; exit 1; }

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "[WARN] 'ffmpeg' is not found in PATH. Image conversions may be limited."
    echo "       Install ffmpeg: 'sudo apt install ffmpeg' (Ubuntu/Debian) or 'brew install ffmpeg' (macOS)."
fi

# 1. Check HM Encoder binary (Release or Debug)
ENCODER_BIN="${HEVC_ENCODER_BIN:-}"
if [ -z "$ENCODER_BIN" ] || [ ! -f "$ENCODER_BIN" ]; then
    FOUND_BIN=$(find "$SCRIPT_DIR/bin" -type f \( -name "TAppEncoder" -o -name "TAppEncoderStatic" \) 2>/dev/null | head -n 1)
    if [ -n "$FOUND_BIN" ] && [ -f "$FOUND_BIN" ]; then
        ENCODER_BIN="$FOUND_BIN"
    fi
fi

# If not found, attempt automatic compilation
if [ -z "$ENCODER_BIN" ] || [ ! -f "$ENCODER_BIN" ]; then
    echo "[INFO] HM Encoder binary not found. Attempting automatic build..."
    echo "       Running: make TAppEncoder-r -j\$(nproc)..."
    (cd "$SCRIPT_DIR" && make TAppEncoder-r -j$(nproc 2>/dev/null || echo 4)) || true
    FOUND_BIN=$(find "$SCRIPT_DIR/bin" -type f \( -name "TAppEncoder" -o -name "TAppEncoderStatic" \) 2>/dev/null | head -n 1)
    if [ -n "$FOUND_BIN" ] && [ -f "$FOUND_BIN" ]; then
        ENCODER_BIN="$FOUND_BIN"
    fi
fi

if [ -n "$ENCODER_BIN" ] && [ -f "$ENCODER_BIN" ]; then
    echo "[OK] HM Encoder binary detected: $ENCODER_BIN"
    export HEVC_ENCODER_BIN="$ENCODER_BIN"
else
    echo "[WARN] HM Encoder binary could not be found or built automatically."
    echo "       Please compile it manually: 'make TAppEncoder-r -j\$(nproc)'"
fi

# 2. Check Backend Virtual Environment
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "[INFO] Creating Python virtual environment in $BACKEND_DIR/venv..."
    python3 -m venv "$BACKEND_DIR/venv"
    "$BACKEND_DIR/venv/bin/pip" install --upgrade pip
    "$BACKEND_DIR/venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
fi

# 3. Check Frontend node_modules
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "[INFO] Installing npm dependencies in $FRONTEND_DIR..."
    (cd "$FRONTEND_DIR" && npm install)
fi

# Cleanup handler on exit
cleanup() {
    echo ""
    echo "[INFO] Stopping all services..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    # Also ensure port processes are released
    fuser -k 8000/tcp 2>/dev/null || true
    fuser -k 5173/tcp 2>/dev/null || true
    echo "[INFO] Services stopped cleanly."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Kill existing stray instances if any
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true

# 4. Start Backend (FastAPI + Uvicorn)
echo "[INFO] Starting Backend on http://localhost:8000..."
(cd "$BACKEND_DIR" && ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!

# Wait briefly for backend to initialize
sleep 2

# 5. Start Frontend (React + Vite)
echo "[INFO] Starting Frontend on http://localhost:5173..."
(cd "$FRONTEND_DIR" && npm run dev -- --host 0.0.0.0 --port 5173) &
FRONTEND_PID=$!

echo ""
echo "============================================================"
echo "  HEVC Analyzer is now LIVE:"
echo "  -> Web App (UI):    http://localhost:5173"
echo "  -> API Docs:        http://localhost:8000/docs"
echo "  -> Health Check:    http://localhost:8000/health"
echo "============================================================"
echo "  Press Ctrl+C to stop both servers."
echo "============================================================"
echo ""

# Wait for both processes
wait
