# HEVC Video Analyzer - Frontend

Modern, high-performance web interface built with **React 19** and **Vite** for deep inspection and visualization of ITU-T H.265 / HEVC video encoding decisions.

---

## Workspace Tabs

The application provides 7 dedicated, distraction-free analysis tabs:

1. **Frame (`MACRO`)**:
   - High-performance recursive QuadTree partition grid overlaid on the original image.
   - Shortcut `T`: Toggle between clean natural image and partition overlay.
   - Interactive CTU and CU selection with instantaneous deselect support.
2. **YUV Planes (`YUV_VIEW`)**:
   - Real-time planar decomposition into Luma ($Y$), Chroma Cb ($U$), and Chroma Cr ($V$) under 4:2:0 subsampling.
   - Color visualization modes: Monochrome, Channel Tint, and Turbo Heatmap.
   - Direct crosshair pixel readout across all 3 planes.
3. **QuadTree (`CP_01`)**:
   - Visual inspection of recursive CU splits ($64\times 64 \rightarrow 8\times 8$) within the selected CTU.
   - Node depth, coordinates, and direct jump to intra prediction analysis.
4. **Intra Prediction (`INTRA_PIPE`)**:
   - 35 Intra candidate modes with RDO cost curves.
   - 360° interactive Angular Compass with angular displacement vectors.
   - 4-stage pipeline stepper: Reference Samples, Angular Projection, Spatial Synthesis, Residual Generation.
5. **Transform & Quant (`CP_06_07`)**:
   - 2D DCT-II and 2D DST-VII frequency spectrum inspection.
   - Energy compaction ratio, DC harmonic energy, and quantized levels with Coded Block Flags (CBF).
6. **Comparison (`FOUR_PIC_VIEW`)**:
   - Side-by-side comparison of Original ($S$), Prediction ($P$), Residual ($R = S - P$), and Reconstructed ($S' = P + R'$).
   - Interactive draggable Split Wipe slider.
   - Residual error amplification multiplier ($1\times, 2\times, 4\times, 8\times$).
7. **4-Way View (`VIEW_4WAY`)**:
   - Synchronized crosshair pixel inspector across Original, Prediction, Residual, and Reconstruction matrices.
   - Switchable 2×2 Grid and 4-Column Side-by-Side layouts across $Y$, $Cb$, $Cr$ channels.

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation
```bash
# From this directory:
npm install
```

### Development Server
```bash
# Starts Vite dev server on http://localhost:5173
npm run dev
```
By default, API requests to `/upload` and `/api` are automatically proxied to `http://localhost:8000` via `vite.config.js`.

### Production Build
```bash
# Typecheck and build optimized bundle into dist/
npm run build

# Preview production build locally
npm run preview
```

### Code Quality & Linting
```bash
# Run ultra-fast oxlint
npm run lint
```

---

## Configuration

If the FastAPI backend is hosted on a custom host or port, you can configure the backend endpoint by creating a `.env` file:

```env
VITE_API_BASE_URL=http://localhost:8000
```
