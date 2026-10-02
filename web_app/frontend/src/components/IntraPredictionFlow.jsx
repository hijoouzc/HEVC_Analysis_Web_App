import React, { useState, useMemo, useCallback } from 'react';
import { INTRA_PRED_ANGLES, INV_ANGLES, getPixelTrace } from '../utils/intraTraceUtils';
import { getIntraModeInfo, getSampleColorAndTextColor, SELECTION_HIGHLIGHT_COLOR } from '../utils/colorUtils';
import ReferencePerimeter from './flow/ReferencePerimeter';
import StageDetailSection from './flow/StageDetailSection';
import ResidualMatrix from './flow/ResidualMatrix';

/**
 * Computes 3-tap lowpass filter [1, 2, 1] / 4 for (2N + 1) reference samples
 * Exactly matches TComPattern.cpp lines 235-260 for Luma block size N
 */
const computeMdisSmoothedRef = (refTop, refLeft, N = 8) => {
  const reqLen = 2 * N + 1;
  if (!refTop || !refLeft || refTop.length < reqLen || refLeft.length < reqLen) {
    return { top: Array(reqLen).fill(128), left: Array(reqLen).fill(128) };
  }
  const smoothedTop = [...refTop];
  const smoothedLeft = [...refLeft];

  // Corner [-1, -1]
  const corner = (refLeft[1] + 2 * refTop[0] + refTop[1] + 2) >> 2;
  smoothedTop[0] = corner;
  smoothedLeft[0] = corner;

  // Top row smoothing: 1 to 2N-1
  for (let x = 1; x < 2 * N; x++) {
    const prev = refTop[x - 1];
    const curr = refTop[x];
    const next = x + 1 < refTop.length ? refTop[x + 1] : refTop[x];
    smoothedTop[x] = (prev + 2 * curr + next + 2) >> 2;
  }

  // Left column smoothing: 1 to 2N-1
  for (let y = 1; y < 2 * N; y++) {
    const prev = refLeft[y - 1];
    const curr = refLeft[y];
    const next = y + 1 < refLeft.length ? refLeft[y + 1] : refLeft[y];
    smoothedLeft[y] = (prev + 2 * curr + next + 2) >> 2;
  }

  return { top: smoothedTop, left: smoothedLeft };
};

/**
 * Computes ray start and end coordinates connected strictly to cell borders,
 * ensuring the ray line never crosses the center and never obscures cell numbers.
 */
const getRayBorderEndpoints = (ref, activeCoord, stageGridCellSize) => {
  if (!ref || !activeCoord || !stageGridCellSize || stageGridCellSize <= 0) {
    return { x1: 0, y1: 0, x2: 0, y2: 0 };
  }
  const refIndex = Number.isFinite(ref.index) ? ref.index : 0;
  const Xmin = stageGridCellSize * (activeCoord.x + 1);
  const Xmax = stageGridCellSize * (activeCoord.x + 2);
  const Ymin = stageGridCellSize * (activeCoord.y + 1);
  const Ymax = stageGridCellSize * (activeCoord.y + 2);
  const Xmid = (Xmin + Xmax) / 2;
  const Ymid = (Ymin + Ymax) / 2;

  let x1, y1;
  if (ref.type === 'top') {
    // Start at bottom border of top reference cell (row 0)
    x1 = stageGridCellSize * refIndex + stageGridCellSize / 2;
    y1 = stageGridCellSize;
  } else {
    // Start at right border of left reference cell (column 0)
    x1 = stageGridCellSize;
    y1 = stageGridCellSize * refIndex + stageGridCellSize / 2;
  }

  const dx = Xmid - x1;
  const dy = Ymid - y1;

  let x2 = Xmid;
  let y2 = Ymid;

  const candidates = [];

  if (Math.abs(dy) > 1e-4) {
    // Top border Ymin
    const tTop = (Ymin - y1) / dy;
    if (tTop >= -1e-4 && tTop <= 1.01) {
      const xAtTop = x1 + tTop * dx;
      if (xAtTop >= Xmin - 0.5 && xAtTop <= Xmax + 0.5) {
        candidates.push({ t: Math.max(0, tTop), x: Math.max(Xmin, Math.min(Xmax, xAtTop)), y: Ymin });
      }
    }
    // Bottom border Ymax
    const tBottom = (Ymax - y1) / dy;
    if (tBottom >= -1e-4 && tBottom <= 1.01) {
      const xAtBottom = x1 + tBottom * dx;
      if (xAtBottom >= Xmin - 0.5 && xAtBottom <= Xmax + 0.5) {
        candidates.push({ t: Math.max(0, tBottom), x: Math.max(Xmin, Math.min(Xmax, xAtBottom)), y: Ymax });
      }
    }
  }

  if (Math.abs(dx) > 1e-4) {
    // Left border Xmin
    const tLeft = (Xmin - x1) / dx;
    if (tLeft >= -1e-4 && tLeft <= 1.01) {
      const yAtLeft = y1 + tLeft * dy;
      if (yAtLeft >= Ymin - 0.5 && yAtLeft <= Ymax + 0.5) {
        candidates.push({ t: Math.max(0, tLeft), x: Xmin, y: Math.max(Ymin, Math.min(Ymax, yAtLeft)) });
      }
    }
    // Right border Xmax
    const tRight = (Xmax - x1) / dx;
    if (tRight >= -1e-4 && tRight <= 1.01) {
      const yAtRight = y1 + tRight * dy;
      if (yAtRight >= Ymin - 0.5 && yAtRight <= Ymax + 0.5) {
        candidates.push({ t: Math.max(0, tRight), x: Xmax, y: Math.max(Ymin, Math.min(Ymax, yAtRight)) });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.t - b.t);
    x2 = candidates[0].x;
    y2 = candidates[0].y;
  }

  return { x1, y1, x2, y2 };
};

const IntraPredictionFlow = ({
  modeData = null,
  refSamples = null,
  currentMode = 0,
  blockSize = 8,
  imagePreview = null,
  _imageDims = { width: 640, height: 360 },
  ctuX = 0,
  ctuY = 0,
  _hoveredCoord = null,
  onHoverCoord = null,
  onBackToQuadTree = null,
  onGoTo4Way = null
}) => {
  const [channel, setChannel] = useState('Y'); // 'Y' (Luma), 'U' (Chroma Cb), 'V' (Chroma Cr)
  const [zoomLevel, setZoomLevel] = useState('fit'); // 'fit' or 'zoom'
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'step1', 'step2', 'step3', 'step4'

  const selectedMode = (modeData && modeData.mode !== undefined) ? modeData.mode : currentMode;
  const modeInfo = getIntraModeInfo(selectedMode);

  // Target block size: strictly 8x8 for Luma, 4x4 for Chroma (ITU-T H.265 4:2:0 subsampling)
  const targetN = (channel === 'Y') ? 8 : 4;

  // Extract raw arrays based on channel
  let rawOrg = null;
  let rawPred = null;
  let rawResi = null;
  let rawRefTop = null;
  let rawRefLeft = null;
  let gtRefTopFilt = null;
  let gtRefLeftFilt = null;

  if (channel === 'U') {
    rawOrg = modeData?.org_u;
    rawPred = modeData?.pred_u;
    rawResi = modeData?.resi_u;
    rawRefTop = modeData?.ref_top_u || refSamples?.ref_unfilt_top_u;
    rawRefLeft = modeData?.ref_left_u || refSamples?.ref_unfilt_left_u;
    gtRefTopFilt = refSamples?.ref_filt_top_u;
    gtRefLeftFilt = refSamples?.ref_filt_left_u;
  } else if (channel === 'V') {
    rawOrg = modeData?.org_v;
    rawPred = modeData?.pred_v;
    rawResi = modeData?.resi_v;
    rawRefTop = modeData?.ref_top_v || refSamples?.ref_unfilt_top_v;
    rawRefLeft = modeData?.ref_left_v || refSamples?.ref_unfilt_left_v;
    gtRefTopFilt = refSamples?.ref_filt_top_v;
    gtRefLeftFilt = refSamples?.ref_filt_left_v;
  } else {
    rawOrg = modeData?.org_data;
    rawPred = modeData?.pred_data;
    rawResi = modeData?.resi_data;
    rawRefTop = modeData?.ref_top || refSamples?.ref_unfilt_top;
    rawRefLeft = modeData?.ref_left || refSamples?.ref_unfilt_left;
    gtRefTopFilt = modeData?.ref_filt_top || refSamples?.ref_filt_top;
    gtRefLeftFilt = modeData?.ref_filt_left || refSamples?.ref_filt_left;
  }

  // Strictly enforce 8x8 for Luma and 4x4 for Chroma in Intra Pipeline to prevent overflow
  const N = targetN;
  const totalPixels = N * N;
  const refSpan = 2 * N + 1;

  const orgData = useMemo(() => (rawOrg && rawOrg.length >= totalPixels) ? rawOrg.slice(0, totalPixels) : Array(totalPixels).fill(128), [rawOrg, totalPixels]);
  const predData = useMemo(() => (rawPred && rawPred.length >= totalPixels) ? rawPred.slice(0, totalPixels) : Array(totalPixels).fill(128), [rawPred, totalPixels]);
  const resiData = useMemo(() => (rawResi && rawResi.length >= totalPixels) ? rawResi.slice(0, totalPixels) : Array(totalPixels).fill(0), [rawResi, totalPixels]);
  const refTopRaw = useMemo(() => (rawRefTop && rawRefTop.length >= refSpan) ? rawRefTop.slice(0, refSpan) : Array(refSpan).fill(128), [rawRefTop, refSpan]);
  const refLeftRaw = useMemo(() => (rawRefLeft && rawRefLeft.length >= refSpan) ? rawRefLeft.slice(0, refSpan) : Array(refSpan).fill(128), [rawRefLeft, refSpan]);

  const angle = INTRA_PRED_ANGLES[selectedMode] ?? 0;
  const invAngle = INV_ANGLES[angle] ?? 0;
  const hasEdgeFilter = (channel === 'Y') && (selectedMode === 1 || selectedMode === 10 || selectedMode === 26) && N <= 16;

  // MDIS check: Luma only, HEVC bypasses MDIS for Chroma
  const isMDISSmoothed = (channel === 'Y') && (
    (modeData && modeData.b_use_filter !== undefined)
      ? modeData.b_use_filter
      : ((selectedMode === 0 || selectedMode === 2 || selectedMode === 18 || selectedMode === 34) && N >= 8)
  );

  // Compute or extract smoothed reference samples for Stage 02
  const simulatedRefs = useMemo(() => computeMdisSmoothedRef(refTopRaw, refLeftRaw, N), [refTopRaw, refLeftRaw, N]);
  const hasGroundTruthFiltered = gtRefTopFilt && gtRefTopFilt.length >= refSpan;
  const refTopFilt = hasGroundTruthFiltered ? gtRefTopFilt : simulatedRefs.top;
  const refLeftFilt = (gtRefLeftFilt && gtRefLeftFilt.length >= refSpan) ? gtRefLeftFilt : simulatedRefs.left;
  const refTopActive = useMemo(() => isMDISSmoothed ? refTopFilt : refTopRaw, [isMDISSmoothed, refTopFilt, refTopRaw]);
  const refLeftActive = useMemo(() => isMDISSmoothed ? refLeftFilt : refLeftRaw, [isMDISSmoothed, refLeftFilt, refLeftRaw]);

  // Active selected pixel and trace (Click-only selection, zero hover flutter)
  const [selectedCoord, setSelectedCoord] = useState({ x: 0, y: 0, val: orgData[0] });
  const activeCoord = (selectedCoord && selectedCoord.x < N && selectedCoord.y < N) ? selectedCoord : null;

  const trace = useMemo(() => {
    if (!activeCoord) return null;
    return getPixelTrace(selectedMode, activeCoord.x, activeCoord.y, N, refTopActive, refLeftActive);
  }, [activeCoord, selectedMode, N, refTopActive, refLeftActive]);

  const activeTopIndices = useMemo(() => {
    if (!trace) return new Set();
    return new Set(trace.refs.filter(r => r.type === 'top').map(r => r.index));
  }, [trace]);

  const activeLeftIndices = useMemo(() => {
    if (!trace) return new Set();
    return new Set(trace.refs.filter(r => r.type === 'left').map(r => r.index));
  }, [trace]);

  const handleCellClick = useCallback((coord) => {
    setSelectedCoord(prev => {
      if (prev && prev.x === coord.x && prev.y === coord.y) {
        if (onHoverCoord) onHoverCoord(null);
        return null;
      }
      if (onHoverCoord) onHoverCoord(coord);
      return coord;
    });
  }, [onHoverCoord]);

  const handleChannelChange = useCallback((newCh) => {
    setChannel(newCh);
    setSelectedCoord(null);
    if (onHoverCoord) onHoverCoord(null);
  }, [onHoverCoord]);

  const getSampleColor = useCallback((val) => {
    return getSampleColorAndTextColor(val, channel);
  }, [channel]);

  const S = 2 * N + 1;
  const stageGridCellSize = zoomLevel === 'zoom'
    ? Math.max(7, Math.floor(460 / S))
    : Math.max(4, Math.floor(300 / S));
  const stageGridSize = stageGridCellSize * S;
  const showCellText = stageGridCellSize >= 13;

  const resiCellSize = Math.max(4, Math.floor((stageGridSize - 50) / N));
  const showResiText = resiCellSize >= 13;

  const getRefStyle = useCallback((val, isActive, isCorner = false, isExtended = false) => {
    const { bg, color } = getSampleColor(val);
    return {
      backgroundColor: bg,
      color: color,
      border: isActive 
        ? `2px solid ${SELECTION_HIGHLIGHT_COLOR}` 
        : (isCorner ? '1.5px solid #0F172A' : (isExtended ? '1px dashed #94A3B8' : '1px solid #64748B')),
      boxShadow: 'none',
      transform: 'none',
      zIndex: isActive ? 15 : 2,
      transition: 'none',
      fontSize: stageGridCellSize >= 20 ? '0.62rem' : stageGridCellSize >= 15 ? '0.50rem' : '0.40rem',
      fontWeight: 700,
      letterSpacing: '-0.5px',
      lineHeight: 1,
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box'
    };
  }, [getSampleColor, stageGridCellSize]);

  return (
    <div className="flow-container">
      {/* 1. COMPACT ENGINEERING TOOLBAR (Replaces old multi-layer headers) */}
      <div className="flow-toolbar">
        <div className="flow-toolbar-left">
          {onBackToQuadTree && (
            <button
              type="button"
              onClick={onBackToQuadTree}
              className="flow-back-btn"
              title="Return to QuadTree CTU layout"
            >
              ← CTU ({ctuX}, {ctuY})
            </button>
          )}
          <div className="flow-status-chip">
            <span className="chip-cu">CU {blockSize}×{blockSize} ({channel === 'Y' ? 'Luma' : channel === 'U' ? 'Cb' : 'Cr'})</span>
            <span className="chip-sep">•</span>
            <span className="chip-mode">Mode {selectedMode}: {modeInfo.name}</span>
          </div>
        </div>

        <div className="flow-toolbar-right">
          {/* Channel Selector Toggle */}
          <div className="channel-segmented-group">
            <button
              type="button"
              className={`channel-pill-btn ${channel === 'Y' ? 'active-y' : ''}`}
              onClick={() => handleChannelChange('Y')}
              title="Luma Y Channel"
            >
              <span className="channel-dot y-dot" /> Y (Luma)
            </button>
            <button
              type="button"
              className={`channel-pill-btn ${channel === 'U' ? 'active-u' : ''}`}
              onClick={() => handleChannelChange('U')}
              title="Chroma Cb Channel (Blue-Difference)"
            >
              <span className="channel-dot u-dot" /> Cb
            </button>
            <button
              type="button"
              className={`channel-pill-btn ${channel === 'V' ? 'active-v' : ''}`}
              onClick={() => handleChannelChange('V')}
              title="Chroma Cr Channel (Red-Difference)"
            >
              <span className="channel-dot v-dot" /> Cr
            </button>
          </div>

          {/* Zoom Toggle */}
          <button
            type="button"
            onClick={() => setZoomLevel(prev => prev === 'fit' ? 'zoom' : 'fit')}
            className="flow-action-btn"
            title="Toggle between fit-to-card and enlarged zoom mode"
          >
            {zoomLevel === 'zoom' ? 'ZOOM: 1.5×' : 'FIT'}
          </button>

          {onGoTo4Way && (
            <button
              type="button"
              onClick={onGoTo4Way}
              className="flow-action-btn primary"
              title="Inspect with Synchronized 4-Way Crosshair Viewport"
            >
              4-WAY VIEW →
            </button>
          )}
        </div>
      </div>

      {/* 2. STAGE STEPPER NAVIGATION */}
      <div className="pipeline-stepper-bar">
        <button
          type="button"
          className={`stepper-pill ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <span className="stepper-idx">Overview</span>
        </button>

        <span className="stepper-arrow">→</span>

        <button
          type="button"
          className={`stepper-pill ${activeTab === 'step1' ? 'active' : ''}`}
          onClick={() => setActiveTab('step1')}
        >
          <span className="stepper-idx">Stage 01</span>
        </button>

        <span className="stepper-arrow">→</span>

        <button
          type="button"
          className={`stepper-pill ${activeTab === 'step2' ? 'active' : ''}`}
          onClick={() => setActiveTab('step2')}
        >
          <span className="stepper-idx">Stage 02</span>
        </button>

        <span className="stepper-arrow">→</span>

        <button
          type="button"
          className={`stepper-pill ${activeTab === 'step3' ? 'active' : ''}`}
          onClick={() => setActiveTab('step3')}
        >
          <span className="stepper-idx">Stage 03</span>
        </button>

        <span className="stepper-arrow">→</span>

        <button
          type="button"
          className={`stepper-pill ${activeTab === 'step4' ? 'active' : ''}`}
          onClick={() => setActiveTab('step4')}
        >
          <span className="stepper-idx">Stage 04</span>
        </button>
      </div>

      {/* 3. VIEW 1: THE LIVE EQUATION TRIO (Original - Prediction = Residual) */}
      {activeTab === 'all' && (
        <>
          <div className="equation-trio-row">
            {/* CARD 1: Original CU & Boundary Refs */}
            <div className="live-matrix-card">
              <div className="live-matrix-header">
                <div className="live-matrix-header-info">
                  <div className="live-matrix-title-wrap">
                    <h3 className="live-matrix-title">ORIGINAL ({channel})</h3>
                  </div>
                </div>
              </div>

              <div 
                className="grid-container pred-grid" 
                style={{ 
                  width: `${stageGridSize}px`, 
                  height: `${stageGridSize}px`, 
                  display: 'grid',
                  gridTemplateColumns: `repeat(${S}, ${stageGridCellSize}px)`,
                  gridTemplateRows: `repeat(${S}, ${stageGridCellSize}px)`,
                  position: 'relative' 
                }}
              >
                {/* Frame around Original Block */}
                <div 
                  style={{
                    position: 'absolute',
                    top: stageGridCellSize,
                    left: stageGridCellSize,
                    width: N * stageGridCellSize,
                    height: N * stageGridCellSize,
                    border: '2px solid #0F172A',
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                    zIndex: 10
                  }} 
                />

                {/* Boundary Reference Samples */}
                <ReferencePerimeter
                  refTop={refTopRaw}
                  refLeft={refLeftRaw}
                  N={N}
                  activeTopIndices={activeTopIndices}
                  activeLeftIndices={activeLeftIndices}
                  showCellText={showCellText}
                  getRefStyle={getRefStyle}
                  prefix="org"
                />

                {/* Original block cells */}
                {orgData.map((val, idx) => {
                  const x = idx % N;
                  const y = Math.floor(idx / N);
                  const isSelected = activeCoord && activeCoord.x === x && activeCoord.y === y;
                  const { bg: cBg, color: cColor } = getSampleColor(val);

                  return (
                    <div 
                      key={`org-cell-${idx}`}
                      className="cell"
                      onClick={() => handleCellClick({ x, y, val })}
                      style={{
                        gridColumn: x + 2,
                        gridRow: y + 2,
                        backgroundColor: cBg,
                        color: cColor,
                        fontWeight: 700,
                        fontSize: stageGridCellSize >= 20 ? '0.62rem' : stageGridCellSize >= 15 ? '0.50rem' : '0.40rem',
                        letterSpacing: '-0.5px',
                        lineHeight: 1,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        border: isSelected ? `2px solid ${SELECTION_HIGHLIGHT_COLOR}` : '1px solid rgba(0, 0, 0, 0.18)',
                        boxShadow: 'none',
                        zIndex: isSelected ? 12 : 1,
                        transform: 'none',
                        transition: 'none'
                      }}
                      title={`Original [${x}, ${y}] = ${val}`}
                    >
                      {showCellText ? val : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* OPERATOR MINUS (−) */}
            <div className="equation-operator" title="Subtraction: Original minus Prediction">
              <span>−</span>
            </div>

            {/* CARD 2: Sample Prediction Block */}
            <div className="live-matrix-card">
              <div className="live-matrix-header">
                <div className="live-matrix-header-info">
                  <div className="live-matrix-title-wrap">
                    <h3 className="live-matrix-title">PREDICTION ({channel})</h3>
                  </div>
                </div>
              </div>

              <div 
                className="grid-container pred-grid" 
                style={{ 
                  width: `${stageGridSize}px`, 
                  height: `${stageGridSize}px`, 
                  display: 'grid',
                  gridTemplateColumns: `repeat(${S}, ${stageGridCellSize}px)`,
                  gridTemplateRows: `repeat(${S}, ${stageGridCellSize}px)`,
                  position: 'relative' 
                }}
              >
                {/* SVG Ray Tracing Layer (Connected strictly to cell borders) */}
                {activeCoord && trace && (
                  <svg 
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      width: stageGridSize, 
                      height: stageGridSize, 
                      pointerEvents: 'none', 
                      zIndex: 14 
                    }}
                  >
                    {trace.refs.map((ref, idx) => {
                      const { x1, y1, x2, y2 } = getRayBorderEndpoints(ref, activeCoord, stageGridCellSize);
                      if (Math.hypot(x2 - x1, y2 - y1) < 1.0) return null;
                      return (
                        <line 
                          key={idx}
                          x1={x1} 
                          y1={y1} 
                          x2={x2} 
                          y2={y2} 
                          stroke={SELECTION_HIGHLIGHT_COLOR} 
                          strokeWidth="2" 
                          strokeDasharray="4 2" 
                        />
                      );
                    })}
                  </svg>
                )}

                {/* Frame around Prediction Block */}
                <div 
                  style={{
                    position: 'absolute',
                    top: stageGridCellSize,
                    left: stageGridCellSize,
                    width: N * stageGridCellSize,
                    height: N * stageGridCellSize,
                    border: '2px solid #0F172A',
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                    zIndex: 10
                  }} 
                />

                {/* Active Reference Perimeter */}
                <ReferencePerimeter
                  refTop={refTopActive}
                  refLeft={refLeftActive}
                  N={N}
                  activeTopIndices={activeTopIndices}
                  activeLeftIndices={activeLeftIndices}
                  showCellText={showCellText}
                  getRefStyle={getRefStyle}
                  prefix="pred"
                />

                {/* Prediction block cells */}
                {predData.map((val, idx) => {
                  const x = idx % N;
                  const y = Math.floor(idx / N);
                  const isSelected = activeCoord && activeCoord.x === x && activeCoord.y === y;
                  const { bg: cBg, color: cColor } = getSampleColor(val);

                  return (
                    <div 
                      key={`pred-live-${selectedMode}-${idx}`} 
                      className="cell pred-cell" 
                      onClick={() => handleCellClick({ x, y, val })}
                      style={{ 
                        gridColumn: x + 2, 
                        gridRow: y + 2, 
                        backgroundColor: cBg, 
                        color: cColor, 
                        cursor: 'pointer',
                        border: isSelected ? `2px solid ${SELECTION_HIGHLIGHT_COLOR}` : '1px solid rgba(0, 0, 0, 0.18)',
                        boxShadow: 'none',
                        zIndex: isSelected ? 12 : 1,
                        transform: 'none',
                        transition: 'none',
                        fontSize: stageGridCellSize >= 20 ? '0.62rem' : stageGridCellSize >= 15 ? '0.50rem' : '0.40rem',
                        fontWeight: 700,
                        letterSpacing: '-0.5px',
                        lineHeight: 1,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box'
                      }}
                      title={`Pred [${x}, ${y}] = ${val}`}
                    >
                      {showCellText ? val : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* OPERATOR EQUALS (=) */}
            <div className="equation-operator" title="Equals: Yields Residual Error Matrix">
              <span>=</span>
            </div>

            {/* CARD 3: STAGE 04 Residual Matrix */}
            <ResidualMatrix
              resiData={resiData}
              orgData={orgData}
              predData={predData}
              N={N}
              cost={modeData?.cost}
              channel={channel}
              stageGridSize={stageGridSize}
              resiCellSize={resiCellSize}
              showResiText={showResiText}
              activeCoord={activeCoord}
              onCellClick={handleCellClick}
            />
          </div>

          {/* 4. DYNAMIC PIXEL INSPECTOR HUD (Replaces static 50px empty banner) */}
          <div className="pixel-inspector-hud">
            {activeCoord && trace ? (
              <div className="hud-content-active">
                <div className="hud-target-badge">
                  PIXEL [{activeCoord.x}, {activeCoord.y}]
                </div>
                <div className="hud-calc-line">
                  <span className="hud-val org">Org: {orgData[activeCoord.y * N + activeCoord.x]}</span>
                  <span className="hud-op">−</span>
                  <span className="hud-val pred">Pred: {predData[activeCoord.y * N + activeCoord.x]}</span>
                  <span className="hud-op">=</span>
                  <span className="hud-val resi">
                    Resi: {resiData[activeCoord.y * N + activeCoord.x] > 0 ? `+${resiData[activeCoord.y * N + activeCoord.x]}` : resiData[activeCoord.y * N + activeCoord.x]}
                  </span>
                </div>
                <div className="hud-formula-line">
                  <span className="hud-formula-tag">RAY TRACE:</span>
                  <span className="hud-formula-text">{trace.text}</span>
                </div>
              </div>
            ) : (
              <div className="hud-content-idle">
                <span className="hud-idle-hint">[PIXEL INSPECTION: NONE SELECTED]</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* 5. VIEWS 2-5: STAGES 01-04 DETAIL BREAKDOWNS */}
      <StageDetailSection
        activeTab={activeTab}
        channel={channel}
        selectedMode={selectedMode}
        modeInfo={modeInfo}
        N={N}
        totalPixels={totalPixels}
        ctuX={ctuX}
        ctuY={ctuY}
        imagePreview={imagePreview}
        refTopRaw={refTopRaw}
        refLeftRaw={refLeftRaw}
        refTopActive={refTopActive}
        isMDISSmoothed={isMDISSmoothed}
        hasEdgeFilter={hasEdgeFilter}
        angle={angle}
        invAngle={invAngle}
        orgData={orgData}
        predData={predData}
        resiData={resiData}
        modeData={modeData}
        getSampleColor={getSampleColor}
      />
    </div>
  );
};

export default IntraPredictionFlow;
