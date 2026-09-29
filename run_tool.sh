#!/usr/bin/env bash

# ==============================================================================
# HEVC Trace-Driven Analyzer - Unified Launcher Script
# Starts both FastAPI Backend (port 8000) and React/Vite Frontend (port 5173)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/web_app/backend"
FRONTEND_DIR="$SCRIPT_DIR/web_app/frontend"
ENCODER_BIN="${HEVC_ENCODER_BIN:-$SCRIPT_DIR/bin/umake/gcc-13.3/x86_64/debug/TAppEncoder}"
if [ ! -f "$ENCODER_BIN" ]; then
    FOUND_BIN=$(find "$SCRIPT_DIR/bin" -type f \( -name "TAppEncoder" -o -name "TAppEncoderStatic" \) 2>/dev/null | head -n 1)
    if [ -n "$FOUND_BIN" ] && [ -f "$FOUND_BIN" ]; then
        ENCODER_BIN="$FOUND_BIN"
    fi
fi

echo "------------------------------------------------------------"
echo "  HEVC TRACE-DRIVEN ANALYZER - STARTUP"
echo "------------------------------------------------------------"

# 1. Check HM Encoder binary
if [ -f "$ENCODER_BIN" ]; then
    echo "[OK] HM Encoder binary detected: $ENCODER_BIN"
    export HEVC_ENCODER_BIN="$ENCODER_BIN"
else
    echo "[WARN] HM Encoder binary not found at $ENCODER_BIN"
    echo "       Please build it using 'make TAppEncoder-d' or cmake if needed."
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
