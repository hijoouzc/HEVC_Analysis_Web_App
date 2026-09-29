import React, { useState } from 'react';
import { INTRA_PRED_ANGLES, INV_ANGLES, getPixelTrace, getWavefrontDelay } from '../utils/intraTraceUtils';
import { getIntraModeInfo } from '../utils/colorUtils';

/**
 * Computes 3-tap lowpass filter [1, 2, 1] / 4 for 33 reference samples
 * Exactly matches TComPattern.cpp lines 235-260 for Luma N=8
 */
const computeMdisSmoothedRef = (refTop, refLeft, N = 8) => {
  if (!refTop || !refLeft || refTop.length < 17 || refLeft.length < 17) {
    return { top: Array(17).fill(128), left: Array(17).fill(128) };
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

const IntraPredictionFlow = ({
  modeData = null,
  refSamples = null,
  currentMode = 0,
  blockSize = 8,
  imagePreview = null,
  imageDims = { width: 640, height: 360 },
  ctuX = 0,
  ctuY = 0,
  hoveredCoord = null,
  onHoverCoord = null,
  onSelectMode = null,
  onBackToQuadTree = null,
  onGoTo4Way = null
}) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'step1', 'step2', 'step3', 'step4'
  const [internalMode, setInternalMode] = useState(null);
  const [displayModeStage1, setDisplayModeStage1] = useState('both'); // 'both', 'values', 'texture'

  const selectedMode = (modeData && modeData.mode !== undefined)
    ? modeData.mode
    : (internalMode ?? currentMode);

  const modeInfo = getIntraModeInfo(selectedMode);
  const N = blockSize; // 8 for luma
  const angle = INTRA_PRED_ANGLES[selectedMode] ?? 0;
  const invAngle = INV_ANGLES[angle] ?? 0;
  const hasEdgeFilter = (selectedMode === 1 || selectedMode === 10 || selectedMode === 26) && N <= 16;
  
  // MDIS check: prioritize ground-truth flag from HM encoder, fall back to N=8 heuristics
  const isMDISSmoothed = (modeData && modeData.b_use_filter !== undefined)
    ? modeData.b_use_filter
    : ((selectedMode === 0 || selectedMode === 2 || selectedMode === 18 || selectedMode === 34) && N === 8);

  // Image dimension calculations
  const origW = imageDims?.width || 640;
  const origH = imageDims?.height || 360;

  // Extract reference and data arrays from modeData if available
  const hasLiveData = modeData && modeData.org_data && modeData.pred_data && modeData.resi_data;
  const orgData = hasLiveData ? modeData.org_data : Array(64).fill(128);
  const predData = hasLiveData ? modeData.pred_data : Array(64).fill(128);
  const resiData = hasLiveData ? modeData.resi_data : Array(64).fill(0);
  const refTopRaw = (hasLiveData && modeData.ref_top) ? modeData.ref_top : Array(17).fill(128);
  const refLeftRaw = (hasLiveData && modeData.ref_left) ? modeData.ref_left : Array(17).fill(128);

  // Compute or extract smoothed reference samples for Stage 02
  const hasGroundTruthFiltered = refSamples && refSamples.ref_filt_top && refSamples.ref_filt_top.length >= 17;
  const { top: simulatedTopFilt, left: simulatedLeftFilt } = computeMdisSmoothedRef(refTopRaw, refLeftRaw, N);
  const refTopFilt = hasGroundTruthFiltered ? refSamples.ref_filt_top : simulatedTopFilt;
  const refLeftFilt = hasGroundTruthFiltered ? refSamples.ref_filt_left : simulatedLeftFilt;
  const refTopActive = isMDISSmoothed ? refTopFilt : refTopRaw;
  const refLeftActive = isMDISSmoothed ? refLeftFilt : refLeftRaw;

  // Active hover and trace
  const activeHover = hoveredCoord;
  const trace = activeHover ? getPixelTrace(selectedMode, activeHover.x, activeHover.y, 8, refTopActive, refLeftActive) : null;
  const activeTopIndices = new Set(trace ? trace.refs.filter(r => r.type === 'top').map(r => r.index) : []);
  const activeLeftIndices = new Set(trace ? trace.refs.filter(r => r.type === 'left').map(r => r.index) : []);

  const handleCellHover = (coord) => {
    if (onHoverCoord) onHoverCoord(coord);
  };

  const getRefStyle = (val, isActive, isCorner = false, isExtended = false) => ({
    backgroundColor: `rgb(${val}, ${val}, ${val})`,
    color: val < 128 ? '#FFFFFF' : '#000000',
    textShadow: val < 128 ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 2px rgba(255,255,255,0.8)',
    border: isActive 
      ? '2.5px solid #2563EB' 
      : (isCorner ? '2px solid #EA580C' : (isExtended ? '1px dashed #94A3B8' : '1.5px solid #64748B')),
    boxShadow: isActive ? '0 0 0 2px rgba(37, 99, 235, 0.4)' : 'none',
    transform: isActive ? 'scale(1.14)' : 'none',
    zIndex: isActive ? 15 : 2,
    transition: 'all 0.1s ease',
    fontSize: '0.58rem',
    fontWeight: 700,
    letterSpacing: '-0.5px',
    lineHeight: 1,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box'
  });

  return (
    <div className="flow-container">
      {/* Drill-Down Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onBackToQuadTree && (
            <button
              type="button"
              onClick={onBackToQuadTree}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono',
                border: '1.5px solid var(--c-black)',
                background: 'var(--c-white)',
                cursor: 'pointer'
              }}
              title="Return to QuadTree CTU layout"
            >
              ← BACK TO QUADTREE CTU ({ctuX}, {ctuY})
            </button>
          )}
          <span style={{ fontSize: '0.85rem', fontWeight: 800, fontFamily: 'JetBrains Mono' }}>
            [LEVEL 3: INTRA PREDICTION PIPELINE]
          </span>
        </div>

        {onGoTo4Way && (
          <button
            type="button"
            onClick={onGoTo4Way}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              border: '1.5px solid var(--c-black)',
              background: 'var(--c-white)',
              cursor: 'pointer'
            }}
            title="Inspect with Synchronized 4-Way Crosshair Viewport"
          >
            4-WAY VIEWPORT →
          </button>
        )}
      </div>

      {/* Top Header */}
      <div className="flow-header">
        <div>
          <h2 className="flow-title">HEVC Intra Prediction Explicit Data Pipeline</h2>
          <p className="flow-subtitle">
            Direct End-to-End Pixel Transformation: Original CU [8×8] → Reference Sampling → MDIS Filter → Sample Prediction → Residual Matrix
          </p>
        </div>

        <div className="flow-mode-badge-wrap">
          <div className="flow-active-badge">
            <span style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase' }}>Active Evaluation</span>
            <strong>Mode {selectedMode}: {modeInfo.name} ({modeInfo.type})</strong>
            <span style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono' }}>
              Angle: {angle} | MDIS: {isMDISSmoothed ? '3-Tap Filtered' : 'Direct'} | Edge Filter: {hasEdgeFilter ? 'Enabled' : 'Bypass'}
            </span>
          </div>
          {onSelectMode && (
            <select 
              value={selectedMode} 
              onChange={(e) => {
                const m = Number(e.target.value);
                setInternalMode(m);
                onSelectMode(m);
              }}
              className="flow-mode-dropdown"
              title="Inspect intra mode in live pipeline"
            >
              {Array.from({ length: 35 }, (_, i) => {
                const info = getIntraModeInfo(i);
                return (
                  <option key={i} value={i}>
                    Mode {i}: {info.name} ({info.type})
                  </option>
                );
              })}
            </select>
          )}
        </div>
      </div>

      {/* TOP SECTION: User Mockup Layout: [INPUT: Original CU (8x8)] ---> [SEQUENTIAL PIPELINE] ---> [OUTPUT: Prediction CU (8x8)] */}
      <div className="live-top-flow-banner">
        {/* Left: INPUT Original CU (8x8) from uploaded image */}
        <div className="live-cu-card">
          <span className="live-card-badge" style={{ background: 'var(--c-magenta)' }}>INPUT: ORIGINAL CU (8×8)</span>
          <div className="live-cu-viewport" style={{ borderColor: 'var(--c-magenta)' }}>
            {imagePreview ? (
              <img 
                src={imagePreview} 
                alt="CU 8x8 Original"
                style={{ 
                  width: `${origW}px`, 
                  height: `${origH}px`, 
                  transformOrigin: '0 0',
                  transform: `scale(22) translate(-${ctuX * 64}px, -${ctuY * 64}px)` 
                }} 
              />
            ) : (
              <div className="empty-viewport-text">No Image</div>
            )}
          </div>
          <div className="live-cu-meta">
            Target CTU [{ctuX}, {ctuY}] Offset ({ctuX * 64}, {ctuY * 64})
          </div>
        </div>

        {/* Arrow to Pipeline */}
        <div className="live-flow-arrow">→</div>

        {/* Center: SEQUENTIAL PIPELINE DATA FLOW */}
        <div className="live-pipeline-chain-box">
          <div className="live-pipeline-title">SEQUENTIAL PIPELINE DATA FLOW</div>
          <div className="live-chain-steps">
            <div className={`live-chain-step ${activeTab === 'step1' ? 'active-step' : ''}`} onClick={() => setActiveTab('step1')}>
              <span className="step-label">STAGE 01</span>
              <strong className="step-name">Reference Sample Prep</strong>
              <span className="step-desc">Neighbouring Reco Pixels</span>
              <span className="step-io">Input: Frame Buffer → Output: 4N+1 (33)</span>
            </div>

            <span className="step-link-arrow">→</span>

            <div className={`live-chain-step ${activeTab === 'step2' ? 'active-step' : ''}`} onClick={() => setActiveTab('step2')}>
              <span className="step-label">STAGE 02</span>
              <strong className="step-name">Substitution & MDIS</strong>
              <span className="step-desc">Hole Fill & 3-Tap Smoothing</span>
              <span className="step-io">Input: 4N+1 Raw → Output: 4N+1 Clean</span>
            </div>

            <span className="step-link-arrow">→</span>

            <div className={`live-chain-step ${activeTab === 'step3' ? 'active-step' : ''}`} onClick={() => setActiveTab('step3')}>
              <span className="step-label">STAGE 03</span>
              <strong className="step-name">Sample Prediction</strong>
              <span className="step-desc">Planar / DC / 33 Directional Angles</span>
              <span className="step-io">Input: 4N+1 Clean → Output: N×N Matrix</span>
            </div>

            <span className="step-link-arrow">→</span>

            <div className={`live-chain-step ${activeTab === 'step4' ? 'active-step' : ''}`} onClick={() => setActiveTab('step4')}>
              <span className="step-label">STAGE 04</span>
              <strong className="step-name">Boundary Filtering</strong>
              <span className="step-desc">Edge Artifact Suppression (Luma)</span>
              <span className="step-io">Input: N×N Matrix → Output: Final Pred (8×8)</span>
            </div>
          </div>
        </div>

        {/* Arrow to Output */}
        <div className="live-flow-arrow">→</div>

        {/* Right: OUTPUT Prediction CU (8x8) generated by the pipeline */}
        <div className="live-cu-card">
          <span className="live-card-badge" style={{ background: 'var(--c-blue)' }}>OUTPUT: PREDICTION (8×8)</span>
          <div className="live-cu-viewport" style={{ borderColor: 'var(--c-blue)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 18px)', gridTemplateRows: 'repeat(8, 18px)' }}>
              {predData.map((val, idx) => (
                <div 
                  key={`out-pred-cell-${idx}`}
                  style={{
                    backgroundColor: `rgb(${val}, ${val}, ${val})`,
                    color: val < 128 ? '#FFF' : '#000',
                    fontSize: '0.45rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'JetBrains Mono',
                    lineHeight: 1,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {val}
                </div>
              ))}
            </div>
          </div>
          <div className="live-cu-meta">
            Mode {selectedMode}: {modeInfo.name} Block
          </div>
        </div>
      </div>

      {/* Stage Navigation Tabs */}
      <div className="flow-nav-tabs">
        <button 
          className={`flow-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Stages (Live Grid Overview)
        </button>
        <button 
          className={`flow-tab-btn ${activeTab === 'step1' ? 'active' : ''}`}
          onClick={() => setActiveTab('step1')}
        >
          Stage 01 Detail: Reference Prep
        </button>
        <button 
          className={`flow-tab-btn ${activeTab === 'step2' ? 'active' : ''}`}
          onClick={() => setActiveTab('step2')}
        >
          Stage 02 Detail: Substitution & MDIS
        </button>
        <button 
          className={`flow-tab-btn ${activeTab === 'step3' ? 'active' : ''}`}
          onClick={() => setActiveTab('step3')}
        >
          Stage 03 Detail: Sample Prediction
        </button>
        <button 
          className={`flow-tab-btn ${activeTab === 'step4' ? 'active' : ''}`}
          onClick={() => setActiveTab('step4')}
        >
          Stage 04 Detail: Boundary & Residual
        </button>
      </div>

      {/* LIVE EQUATION READOUT BAR (Explicit transformation upon hover) */}
      <div className="live-equation-readout">
        {activeHover && hasLiveData ? (
          <div className="equation-active-wrap">
            <div className="equation-tag">EXPLICIT PIXEL TRANSFORMATION [ {activeHover.x}, {activeHover.y} ]</div>
            <div className="equation-math">
              <span className="eq-term">
                Original[{activeHover.x}, {activeHover.y}] = <strong>{orgData[activeHover.y * 8 + activeHover.x]}</strong>
              </span>
              <span className="eq-op">──(Mode {selectedMode} {modeInfo.name} Projection)──&gt;</span>
              <span className="eq-term" style={{ color: 'var(--c-blue)' }}>
                Predicted = <strong>{predData[activeHover.y * 8 + activeHover.x]}</strong>
              </span>
              <span className="eq-op">──(Residual Subtraction)──&gt;</span>
              <span className="eq-term" style={{ color: 'var(--c-magenta)' }}>
                Residual = <strong>{resiData[activeHover.y * 8 + activeHover.x]}</strong>
              </span>
            </div>
            {trace && (
              <div className="equation-trace-text">
                Prediction Derivation: {trace.text}
              </div>
            )}
          </div>
        ) : (
          <div className="equation-placeholder">
            Hover over any pixel in Stage 01 (Original), Stage 03 (Prediction), or Stage 04 (Residual) to view explicit step-by-step mathematical transformation
          </div>
        )}
      </div>

      {/* VIEW 1: ALL STAGES LIVE MATRICES (Directly matching User Mockup) */}
      {activeTab === 'all' && (
        <div className="live-matrices-row">
          {/* STAGE 01: Reference Boundary Samples & Original CU (8x8) */}
          <div className="live-matrix-card">
            <div className="live-matrix-header">
              <div className="live-matrix-header-info">
                <span className="stage-mini-badge" style={{ background: '#8DC63F', color: '#000' }}>STAGE 01</span>
                <div className="live-matrix-title-wrap">
                  <h3 className="live-matrix-title">ORIGINAL (Y) & BOUNDARY REFS</h3>
                  <span className="live-matrix-sub">4N+1 (33) Reconstructed Boundary Samples framing 8×8 CU</span>
                </div>
              </div>
              <div className="view-toggle-wrap">
                <button 
                  className={`toggle-btn ${displayModeStage1 === 'both' ? 'active' : ''}`}
                  onClick={() => setDisplayModeStage1('both')}
                >
                  Blend
                </button>
                <button 
                  className={`toggle-btn ${displayModeStage1 === 'values' ? 'active' : ''}`}
                  onClick={() => setDisplayModeStage1('values')}
                >
                  Values
                </button>
                <button 
                  className={`toggle-btn ${displayModeStage1 === 'texture' ? 'active' : ''}`}
                  onClick={() => setDisplayModeStage1('texture')}
                >
                  Texture
                </button>
              </div>
            </div>

            <div 
              className="grid-container grid-17x17 pred-grid" 
              style={{ width: '374px', height: '374px', position: 'relative' }}
              onMouseLeave={() => handleCellHover(null)}
            >
              {/* Top-Left Corner Reference */}
              <div 
                className="cell ref-cell" 
                style={{ 
                  gridColumn: 1, 
                  gridRow: 1, 
                  ...getRefStyle(refTopRaw[0], activeTopIndices.has(0) || activeLeftIndices.has(0), true, false)
                }}
                title="Top-Left Reference [-1, -1] (Corner)"
              >
                {refTopRaw[0]}
              </div>

              {/* Direct Top (8 samples: [0..7, -1]) */}
              {refTopRaw.slice(1, 9).map((val, idx) => {
                const topIdx = idx + 1;
                const isActive = activeTopIndices.has(topIdx);
                return (
                  <div 
                    key={`top-org-${idx}`} 
                    className="cell ref-cell" 
                    style={{ gridColumn: idx + 2, gridRow: 1, ...getRefStyle(val, isActive, false, false) }}
                    title={`Top Reference [${idx}, -1] = ${val}`}
                  >
                    {val}
                  </div>
                );
              })}

              {/* Extended Top-Right (8 samples: [8..15, -1]) */}
              {refTopRaw.slice(9).map((val, idx) => {
                const topIdx = idx + 9;
                const isActive = activeTopIndices.has(topIdx);
                return (
                  <div 
                    key={`top-ext-org-${idx}`} 
                    className="cell ref-cell ref-extended" 
                    style={{ gridColumn: idx + 10, gridRow: 1, ...getRefStyle(val, isActive, false, true) }}
                    title={`Top-Right Ext Reference [${idx + 8}, -1] = ${val}`}
                  >
                    {val}
                  </div>
                );
              })}

              {/* Direct Left (8 samples: [-1, 0..7]) */}
              {refLeftRaw.slice(1, 9).map((val, idx) => {
                const leftIdx = idx + 1;
                const isActive = activeLeftIndices.has(leftIdx);
                return (
                  <div 
                    key={`left-org-${idx}`} 
                    className="cell ref-cell" 
                    style={{ gridColumn: 1, gridRow: idx + 2, ...getRefStyle(val, isActive, false, false) }}
                    title={`Left Reference [-1, ${idx}] = ${val}`}
                  >
                    {val}
                  </div>
                );
              })}

              {/* Extended Below-Left (8 samples: [-1, 8..15]) */}
              {refLeftRaw.slice(9).map((val, idx) => {
                const leftIdx = idx + 9;
                const isActive = activeLeftIndices.has(leftIdx);
                return (
                  <div 
                    key={`left-ext-org-${idx}`} 
                    className="cell ref-cell ref-extended" 
                    style={{ gridColumn: 1, gridRow: idx + 10, ...getRefStyle(val, isActive, false, true) }}
                    title={`Below-Left Ext Reference [-1, ${idx + 8}] = ${val}`}
                  >
                    {val}
                  </div>
                );
              })}

              {/* Center 8x8 Original Block Container */}
              <div 
                style={{
                  gridColumn: '2 / span 8',
                  gridRow: '2 / span 8',
                  position: 'relative',
                  width: 176,
                  height: 176,
                  overflow: 'hidden',
                  border: '2px solid var(--c-magenta)',
                  boxSizing: 'border-box'
                }}
              >
                {/* Cropped Image Texture Background */}
                {imagePreview && displayModeStage1 !== 'values' && (
                  <img 
                    src={imagePreview} 
                    alt="Original Luma Texture" 
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${origW}px`,
                      height: `${origH}px`,
                      transformOrigin: '0 0',
                      transform: `scale(22) translate(-${ctuX * 64}px, -${ctuY * 64}px)`,
                      zIndex: 0,
                      imageRendering: 'pixelated',
                      filter: 'grayscale(100%)',
                      opacity: displayModeStage1 === 'texture' ? 1.0 : 0.4
                    }}
                  />
                )}

                {/* 8x8 Cells Overlay */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gridTemplateRows: 'repeat(8, 22px)', position: 'relative', zIndex: 1 }}>
                  {orgData.map((val, idx) => {
                    const x = idx % 8;
                    const y = Math.floor(idx / 8);
                    const isHovered = activeHover && activeHover.x === x && activeHover.y === y;
                    return (
                      <div 
                        key={`org-cell-${idx}`}
                        className="cell"
                        onMouseEnter={() => handleCellHover({ x, y, val })}
                        style={{
                          backgroundColor: displayModeStage1 === 'values' 
                            ? `rgb(${val}, ${val}, ${val})` 
                            : (displayModeStage1 === 'texture' ? 'transparent' : 'rgba(0,0,0,0.15)'),
                          color: displayModeStage1 === 'texture' ? 'transparent' : (val < 128 ? '#FFF' : '#000'),
                          textShadow: displayModeStage1 === 'texture' ? 'none' : (val < 128 ? '0 0 2px #000' : '0 0 2px #FFF'),
                          fontWeight: 700,
                          fontSize: '0.58rem',
                          letterSpacing: '-0.5px',
                          lineHeight: 1,
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxSizing: 'border-box',
                          cursor: 'crosshair',
                          boxShadow: isHovered ? '0 0 0 2px #000, 0 0 0 3px #FFD200' : 'none',
                          zIndex: isHovered ? 12 : 1,
                          transform: isHovered ? 'scale(1.12)' : 'none',
                          transition: 'all 0.1s ease'
                        }}
                        title={`Original [${x}, ${y}] = ${val}`}
                      >
                        {displayModeStage1 !== 'texture' ? val : ''}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom-Right Metadata Card */}
              <div 
                style={{
                  gridColumn: '10 / span 8',
                  gridRow: '10 / span 8',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: '#FAFAFA',
                  border: '1.5px solid #000',
                  padding: '8px',
                  textAlign: 'center',
                  fontSize: '0.68rem',
                  color: '#333',
                  boxSizing: 'border-box',
                  width: '100%',
                  height: '100%'
                }}
              >
                <div style={{ fontWeight: 700, color: '#000', marginBottom: '4px' }}>INPUT BUFFER</div>
                <div>Top: 17 Ref Pels</div>
                <div>Left: 17 Ref Pels</div>
                <div style={{ marginTop: '4px', fontWeight: 600, color: 'var(--c-magenta)' }}>
                  Target: CU 8×8 (64)
                </div>
              </div>
            </div>
          </div>

          {/* STAGE 03: Sample Prediction Block (8x8) */}
          <div className="live-matrix-card">
            <div className="live-matrix-header">
              <div className="live-matrix-header-info">
                <span className="stage-mini-badge" style={{ background: 'var(--c-blue)', color: '#FFF' }}>STAGE 03</span>
                <div className="live-matrix-title-wrap">
                  <h3 className="live-matrix-title">PREDICTION (Y)</h3>
                  <span className="live-matrix-sub">Mode {selectedMode}: {modeInfo.name} Directional Ray Tracing</span>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'JetBrains Mono', padding: '0.2rem 0.5rem', background: '#F0F0F0', border: '1px solid #CCC', flexShrink: 0 }}>
                A = {angle}
              </div>
            </div>

            <div 
              className="grid-container grid-17x17 pred-grid" 
              style={{ width: '374px', height: '374px', position: 'relative' }}
              onMouseLeave={() => handleCellHover(null)}
            >
              {/* SVG Ray Tracing Layer */}
              {activeHover && trace && (
                <svg 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: 374, 
                    height: 374, 
                    pointerEvents: 'none', 
                    zIndex: 11 
                  }}
                >
                  {trace.refs.map((ref, idx) => {
                    const x2 = 22 * (activeHover.x + 1) + 11;
                    const y2 = 22 * (activeHover.y + 1) + 11;
                    const x1 = ref.type === 'top' ? 22 * ref.index + 11 : 11;
                    const y1 = ref.type === 'left' ? 22 * ref.index + 11 : 11;

                    return (
                      <g key={idx}>
                        <line 
                          x1={x1} 
                          y1={y1} 
                          x2={x2} 
                          y2={y2} 
                          stroke="#2563EB" 
                          strokeWidth="2" 
                          strokeDasharray="3 2" 
                        />
                        <circle cx={x1} cy={y1} r="3.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1" />
                      </g>
                    );
                  })}
                  <circle 
                    cx={22 * (activeHover.x + 1) + 11} 
                    cy={22 * (activeHover.y + 1) + 11} 
                    r="4" 
                    fill="#2563EB" 
                    stroke="#FFFFFF" 
                    strokeWidth="1.5" 
                  />
                </svg>
              )}

              {/* Green border frame around 8x8 Prediction Block */}
              <div 
                style={{
                  position: 'absolute',
                  top: 22,
                  left: 22,
                  width: 176,
                  height: 176,
                  border: '2px solid var(--c-green)',
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                  zIndex: 10
                }} 
              />

              {/* Top-Left Corner Reference */}
              <div 
                className="cell ref-cell" 
                style={{ 
                  gridColumn: 1, 
                  gridRow: 1, 
                  ...getRefStyle(refTopActive[0], activeTopIndices.has(0) || activeLeftIndices.has(0), true, false)
                }}
                title="Top-Left [-1,-1] (Corner)"
              >
                {refTopActive[0]}
              </div>

              {/* Direct Top (8 samples: [0..7, -1]) */}
              {refTopActive.slice(1, 9).map((val, idx) => {
                const topIdx = idx + 1;
                const isActive = activeTopIndices.has(topIdx);
                return (
                  <div 
                    key={`top-pred-${idx}`} 
                    className="cell ref-cell" 
                    style={{ gridColumn: idx + 2, gridRow: 1, ...getRefStyle(val, isActive, false, false) }}
                    title={`Top [${idx},-1] = ${val}`}
                  >
                    {val}
                  </div>
                );
              })}

              {/* Extended Top-Right (8 samples: [8..15, -1]) */}
              {refTopActive.slice(9).map((val, idx) => {
                const topIdx = idx + 9;
                const isActive = activeTopIndices.has(topIdx);
                return (
                  <div 
                    key={`top-ext-pred-${idx}`} 
                    className="cell ref-cell ref-extended" 
                    style={{ gridColumn: idx + 10, gridRow: 1, ...getRefStyle(val, isActive, false, true) }}
                    title={`Top-Right Ext [${idx+8},-1] = ${val}`}
                  >
                    {val}
                  </div>
                );
              })}

              {/* Direct Left (8 samples: [-1, 0..7]) */}
              {refLeftActive.slice(1, 9).map((val, idx) => {
                const leftIdx = idx + 1;
                const isActive = activeLeftIndices.has(leftIdx);
                return (
                  <div 
                    key={`left-pred-${idx}`} 
                    className="cell ref-cell" 
                    style={{ gridColumn: 1, gridRow: idx + 2, ...getRefStyle(val, isActive, false, false) }}
                    title={`Left [-1,${idx}] = ${val}`}
                  >
                    {val}
                  </div>
                );
              })}

              {/* Extended Below-Left (8 samples: [-1, 8..15]) */}
              {refLeftActive.slice(9).map((val, idx) => {
                const leftIdx = idx + 9;
                const isActive = activeLeftIndices.has(leftIdx);
                return (
                  <div 
                    key={`left-ext-pred-${idx}`} 
                    className="cell ref-cell ref-extended" 
                    style={{ gridColumn: 1, gridRow: idx + 10, ...getRefStyle(val, isActive, false, true) }}
                    title={`Below-Left Ext [-1,${idx+8}] = ${val}`}
                  >
                    {val}
                  </div>
                );
              })}

              {/* 8x8 Prediction block cells */}
              {predData.map((val, idx) => {
                const x = idx % 8;
                const y = Math.floor(idx / 8);
                const isHovered = activeHover && activeHover.x === x && activeHover.y === y;

                return (
                  <div 
                    key={`pred-live-${selectedMode}-${idx}`} 
                    className="cell pred-cell pred-cell-wave" 
                    onMouseEnter={() => handleCellHover({ x, y, val })}
                    style={{ 
                      gridColumn: x + 2, 
                      gridRow: y + 2, 
                      backgroundColor: `rgb(${val}, ${val}, ${val})`, 
                      color: val < 128 ? '#FFF' : '#000',
                      textShadow: val < 128 ? '0 0 2px #000' : '0 0 2px #FFF',
                      cursor: 'crosshair',
                      boxShadow: isHovered ? '0 0 0 2px #000, 0 0 0 3px #FFD200' : 'none',
                      zIndex: isHovered ? 12 : 1,
                      transform: isHovered ? 'scale(1.12)' : 'none',
                      transition: 'all 0.1s ease',
                      animationDelay: `${getWavefrontDelay(selectedMode, x, y, 8)}s`,
                      fontSize: '0.58rem',
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
                    {val}
                  </div>
                );
              })}

              {/* Bottom-right Traceback info box */}
              {activeHover && trace ? (
                <div 
                  style={{
                    gridColumn: '10 / span 8',
                    gridRow: '10 / span 8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    background: '#F8FAFC',
                    border: '1.5px solid #CBD5E1',
                    padding: '8px',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '3px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                      Derivation [{activeHover.x}, {activeHover.y}]
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, fontFamily: 'JetBrains Mono', color: '#2563EB' }}>
                      Pred: {predData[activeHover.y * 8 + activeHover.x]}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#1E293B', lineHeight: 1.35, fontWeight: 500, fontFamily: 'JetBrains Mono', wordBreak: 'break-word' }}>
                    {trace.text}
                  </div>
                </div>
              ) : (
                <div 
                  style={{
                    gridColumn: '10 / span 8',
                    gridRow: '10 / span 8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#F8FAFC',
                    border: '1px dashed #CBD5E1',
                    padding: '8px',
                    textAlign: 'center',
                    boxSizing: 'border-box'
                  }}
                >
                  <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>Hover any pixel [x, y]</span>
                  <span style={{ fontSize: '0.58rem', color: '#94A3B8', marginTop: '2px' }}>to inspect exact arithmetic formula</span>
                </div>
              )}
            </div>
          </div>

          {/* STAGE 04: Residual Matrix (Y) */}
          <div className="live-matrix-card">
            <div className="live-matrix-header">
              <div className="live-matrix-header-info">
                <span className="stage-mini-badge" style={{ background: 'var(--c-magenta)', color: '#FFF' }}>STAGE 04</span>
                <div className="live-matrix-title-wrap">
                  <h3 className="live-matrix-title">RESIDUAL (Y)</h3>
                  <span className="live-matrix-sub">Org[x, y] − Pred[x, y] = Resi[x, y]</span>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--c-magenta)', padding: '0.2rem 0.5rem', background: '#FFF0F5', border: '1px solid var(--c-magenta)', flexShrink: 0 }}>
                COST: {modeData?.cost?.toFixed(1) || '0.0'}
              </div>
            </div>

            <div 
              style={{ 
                width: '374px', 
                height: '374px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: '#F9F9F9',
                border: '2px solid var(--c-black)',
                padding: '12px'
              }}
              onMouseLeave={() => handleCellHover(null)}
            >
              {/* 8x8 Residual Matrix Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 38px)', gridTemplateRows: 'repeat(8, 38px)', border: '2px solid #000' }}>
                {resiData.map((val, idx) => {
                  const x = idx % 8;
                  const y = Math.floor(idx / 8);
                  const isHovered = activeHover && activeHover.x === x && activeHover.y === y;

                  let bg = '';
                  let color = '';
                  if (val === 0) {
                    bg = '#E6E6E6';
                    color = '#888';
                  } else {
                    const intensity = Math.min(1, Math.abs(val) / 64);
                    bg = val > 0 ? `rgba(222, 0, 106, ${intensity})` : `rgba(245, 130, 32, ${intensity})`;
                    color = intensity > 0.45 ? '#FFF' : '#000';
                  }

                  return (
                    <div 
                      key={`resi-live-${idx}`}
                      className="cell"
                      onMouseEnter={() => handleCellHover({ x, y, val })}
                      style={{
                        backgroundColor: bg,
                        color: color,
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        fontFamily: 'JetBrains Mono',
                        cursor: 'crosshair',
                        boxShadow: isHovered ? '0 0 0 2px #000, 0 0 0 3px #FFD200' : 'none',
                        zIndex: isHovered ? 12 : 1,
                        transform: isHovered ? 'scale(1.12)' : 'none',
                        transition: 'all 0.1s ease',
                        letterSpacing: '-0.5px',
                        lineHeight: 1,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box'
                      }}
                      title={`Org(${orgData[idx]}) − Pred(${predData[idx]}) = Resi(${val})`}
                    >
                      {val > 0 ? `+${val}` : val}
                    </div>
                  );
                })}
              </div>

              {/* Residual Legend */}
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '14px', fontSize: '0.75rem', fontFamily: 'JetBrains Mono' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 12, height: 12, background: 'var(--c-magenta)', display: 'inline-block' }}></span>
                  <span>+ Under-pred</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 12, height: 12, background: 'var(--c-orange)', display: 'inline-block' }}></span>
                  <span>− Over-pred</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 12, height: 12, background: '#E6E6E6', display: 'inline-block', border: '1px solid #CCC' }}></span>
                  <span>0 Exact match</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: STAGE 01 DETAIL (EXPLICIT INPUT ---> PROCESS ---> OUTPUT) */}
      {activeTab === 'step1' && (
        <div className="stage-detail-box">
          <div className="stage-detail-header">
            <span className="stage-tag">STAGE 01 DETAIL</span>
            <h3 className="stage-title">Reference Sample Preparation & Boundary Fetching</h3>
            <span className="stage-func">HM Codebase: TComPrediction::initIntraPatternChType() & fillReferenceSamples() (TComPattern.cpp)</span>
          </div>

          <div className="stage-io-row">
            {/* INPUT CARD */}
            <div className="stage-io-col">
              <span className="io-col-badge">INPUT DATA</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Variable:</strong> <code>piRoiOrigin</code></div>
                <div className="io-meta-line"><strong>C++ Type:</strong> <code>const Pel*</code> (Reconstructed Picture)</div>
                <div className="io-meta-line"><strong>Coordinates:</strong> CTU [{ctuX}, {ctuY}] Offset ({ctuX * 64}, {ctuY * 64})</div>
                <div className="io-meta-line"><strong>Flags:</strong> 5 Neighboring Availability Statuses</div>

                {/* Input Visual */}
                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  {imagePreview ? (
                    <div style={{ position: 'relative', width: '220px', height: '140px', overflow: 'hidden', border: '2px solid #000' }}>
                      <img src={imagePreview} alt="Reconstructed Frame" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div 
                        style={{
                          position: 'absolute',
                          left: '30%',
                          top: '30%',
                          width: '40px',
                          height: '40px',
                          border: '2px solid #FFD200',
                          background: 'rgba(255, 210, 0, 0.25)'
                        }} 
                      />
                    </div>
                  ) : <div>No Image Available</div>}
                </div>
                <span className="io-caption">Surrounding reconstructed pixels in frame</span>
              </div>
            </div>

            {/* PROCESS CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
              <span className="process-label">initIntraPatternChType</span>
            </div>

            <div className="stage-io-col" style={{ flex: 1.2 }}>
              <span className="io-col-badge" style={{ background: '#000', color: '#FFF' }}>HM C++ PROCESS & FORMULA</span>
              <div className="stage-io-card" style={{ background: '#FFF' }}>
                <div className="formula-badge">HEVC Spec §8.4.4.2.2 Boundary Extraction</div>
                <div className="math-display" style={{ fontSize: '0.78rem' }}>
                  <div className="math-row">
                    <span className="math-lhs">Top Samples:</span>
                    <span className="math-rhs">p[x][-1] = Reco[xCU + x, yCU - 1], &nbsp; x ∈ [-1, 2N-1]</span>
                  </div>
                  <div className="math-row">
                    <span className="math-lhs">Left Samples:</span>
                    <span className="math-rhs">p[-1][y] = Reco[xCU - 1, yCU + y], &nbsp; y ∈ [0, 2N-1]</span>
                  </div>
                </div>

                <div style={{ marginTop: '10px', fontSize: '0.74rem', color: '#333', lineHeight: 1.4 }}>
                  • Evaluates 5 boundary flags: <code>isAboveLeftAvailable</code>, <code>isAboveAvailable</code>, <code>isAboveRightAvailable</code>, <code>isLeftAvailable</code>, <code>isBelowLeftAvailable</code>.<br />
                  • Gathers 1 Top-Left + 2N (16) Above + 2N (16) Left = <strong>4N + 1 (33 samples)</strong>.
                </div>
              </div>
            </div>

            {/* OUTPUT CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
              <span className="process-label">pRaw[33]</span>
            </div>

            <div className="stage-io-col">
              <span className="io-col-badge" style={{ background: 'var(--c-green)', color: '#000' }}>OUTPUT DATA</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Variable:</strong> <code>piIntraTemp</code> (PRED_BUF_UNFILTERED)</div>
                <div className="io-meta-line"><strong>C++ Type:</strong> <code>Pel[4N+1]</code> (1 × 33 vector)</div>
                <div className="io-meta-line"><strong>Sample Count:</strong> 33 Raw Perimeter Samples</div>

                {/* Output Strip Visual */}
                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: '4px' }}>Top Row (17 Pels):</div>
                  <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap', maxWidth: '220px' }}>
                    {refTopRaw.map((v, i) => (
                      <div key={i} style={{ width: 12, height: 16, background: `rgb(${v},${v},${v})`, color: v<128?'#FFF':'#000', fontSize: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {v}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, marginTop: '6px', marginBottom: '4px' }}>Left Col (17 Pels):</div>
                  <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap', maxWidth: '220px' }}>
                    {refLeftRaw.map((v, i) => (
                      <div key={i} style={{ width: 12, height: 16, background: `rgb(${v},${v},${v})`, color: v<128?'#FFF':'#000', fontSize: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {v}
                      </div>
                    ))}
                  </div>
                </div>
                <span className="io-caption">33 Raw Boundary Samples ready for MDIS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: STAGE 02 DETAIL (EXPLICIT INPUT ---> PROCESS ---> OUTPUT) */}
      {activeTab === 'step2' && (
        <div className="stage-detail-box">
          <div className="stage-detail-header">
            <span className="stage-tag">STAGE 02 DETAIL</span>
            <h3 className="stage-title">Reference Substitution & Mode-Dependent Smoothing (MDIS)</h3>
            <span className="stage-func">HM Codebase: TComPrediction::initIntraPatternChType() & fillReferenceSamples() (TComPattern.cpp)</span>
          </div>

          <div className="stage-io-row">
            {/* INPUT CARD */}
            <div className="stage-io-col">
              <span className="io-col-badge">INPUT: RAW REFS</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Variable:</strong> <code>piIntraTemp</code> (PRED_BUF_UNFILTERED)</div>
                <div className="io-meta-line"><strong>Active Mode:</strong> Mode {selectedMode} ({modeInfo.name})</div>
                <div className="io-meta-line"><strong>MDIS Status:</strong> {isMDISSmoothed ? '3-Tap Filter Triggered' : 'Direct Bypass'}</div>

                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>Raw Top Reference:</div>
                  <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap', maxWidth: '220px' }}>
                    {refTopRaw.map((v, i) => (
                      <div key={i} style={{ width: 12, height: 16, background: `rgb(${v},${v},${v})`, color: v<128?'#FFF':'#000', fontSize: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {v}
                      </div>
                    ))}
                  </div>
                </div>
                <span className="io-caption">Unsmoothed raw perimeter array</span>
              </div>
            </div>

            {/* PROCESS CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
              <span className="process-label">[1, 2, 1] / 4</span>
            </div>

            <div className="stage-io-col" style={{ flex: 1.2 }}>
              <span className="io-col-badge" style={{ background: '#000', color: '#FFF' }}>HM C++ PROCESS & FORMULA</span>
              <div className="stage-io-card" style={{ background: '#FFF' }}>
                <div className="formula-badge">3-Tap Smoothing Lowpass Kernel [1, 2, 1] / 4</div>
                <div className="math-display" style={{ fontSize: '0.78rem' }}>
                  <div className="math-row">
                    <span className="math-lhs">Top Filter:</span>
                    <span className="math-rhs">p'[x][-1] = (p[x-1][-1] + 2·p[x][-1] + p[x+1][-1] + 2) &gt;&gt; 2</span>
                  </div>
                  <div className="math-row">
                    <span className="math-lhs">Left Filter:</span>
                    <span className="math-rhs">p'[-1][y] = (p[-1][y-1] + 2·p[-1][y] + p[-1][y+1] + 2) &gt;&gt; 2</span>
                  </div>
                </div>

                <div style={{ marginTop: '10px', fontSize: '0.74rem', color: '#333', lineHeight: 1.4 }}>
                  • <strong>MDIS Criteria for N=8:</strong> Modes &#123;0 (Planar), 2, 18, 34 (45° Diagonals)&#125; activate the 3-tap filter to eliminate high-frequency perimeter noise. All other modes bypass to preserve crisp directional edges.
                </div>
              </div>
            </div>

            {/* OUTPUT CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
              <span className="process-label">pFilt[33]</span>
            </div>

            <div className="stage-io-col">
              <span className="io-col-badge" style={{ background: 'var(--c-blue)', color: '#FFF' }}>OUTPUT: CLEAN REFS</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Variable:</strong> <code>m_piYuvExt[...][PRED_BUF_FILTERED]</code></div>
                <div className="io-meta-line"><strong>Status:</strong> {isMDISSmoothed ? 'Smoothed Array' : 'Direct Pass-through'}</div>
                <div className="io-meta-line"><strong>Output Count:</strong> 33 Clean Samples</div>

                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>Effective Top Reference:</div>
                  <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap', maxWidth: '220px' }}>
                    {refTopActive.map((v, i) => (
                      <div key={i} style={{ width: 12, height: 16, background: `rgb(${v},${v},${v})`, color: v<128?'#FFF':'#000', fontSize: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {v}
                      </div>
                    ))}
                  </div>
                </div>
                <span className="io-caption">Supplied to predIntraAng for matrix generation</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: STAGE 03 DETAIL (EXPLICIT INPUT ---> PROCESS ---> OUTPUT) */}
      {activeTab === 'step3' && (
        <div className="stage-detail-box">
          <div className="stage-detail-header">
            <span className="stage-tag">STAGE 03 DETAIL</span>
            <h3 className="stage-title">Sample Prediction: Planar / DC / 33 Directional Angles</h3>
            <span className="stage-func">HM Codebase: TComPrediction::xPredIntraAng() & xPredIntraPlanar()</span>
          </div>

          <div className="stage-io-row">
            {/* INPUT CARD */}
            <div className="stage-io-col">
              <span className="io-col-badge">INPUT: REFS & PARAMS</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Variable:</strong> <code>ptrSrc = getPredictorPtr(...)</code></div>
                <div className="io-meta-line"><strong>Active Mode:</strong> Mode {selectedMode} ({modeInfo.name})</div>
                <div className="io-meta-line"><strong>Angle Displacement A:</strong> {angle} (1/32nd sub-pel)</div>
                <div className="io-meta-line"><strong>Inverse Angle B:</strong> {invAngle || 'None'}</div>

                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>Perimeter Buffer:</div>
                  <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap', maxWidth: '220px' }}>
                    {refTopActive.slice(0, 10).map((v, i) => (
                      <div key={i} style={{ width: 18, height: 18, background: `rgb(${v},${v},${v})`, color: v<128?'#FFF':'#000', fontSize: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {v}
                      </div>
                    ))}
                  </div>
                </div>
                <span className="io-caption">33 reference samples guiding directional projection</span>
              </div>
            </div>

            {/* PROCESS CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
              <span className="process-label">xPredIntraAng</span>
            </div>

            <div className="stage-io-col" style={{ flex: 1.2 }}>
              <span className="io-col-badge" style={{ background: '#000', color: '#FFF' }}>HM C++ PROCESS & FORMULA</span>
              <div className="stage-io-card" style={{ background: '#FFF' }}>
                <div className="formula-badge">Mathematical Prediction for Mode {selectedMode}</div>
                {selectedMode === 0 ? (
                  <div className="math-display" style={{ fontSize: '0.78rem' }}>
                    <div className="math-row">
                      <span className="math-lhs">p_h =</span>
                      <span className="math-rhs">(N - 1 - x)·p[-1][y] + (x + 1)·p[N][-1]</span>
                    </div>
                    <div className="math-row">
                      <span className="math-lhs">p_v =</span>
                      <span className="math-rhs">(N - 1 - y)·p[x][-1] + (y + 1)·p[-1][N]</span>
                    </div>
                    <div className="math-row">
                      <span className="math-lhs">pred[x, y] =</span>
                      <span className="math-rhs">(p_h + p_v + N) &gt;&gt; (log₂(N) + 1)</span>
                    </div>
                  </div>
                ) : selectedMode === 1 ? (
                  <div className="math-display" style={{ fontSize: '0.78rem' }}>
                    <div className="math-row">
                      <span className="math-lhs">dcVal =</span>
                      <span className="math-rhs">[ ∑ p[x'][-1] + ∑ p[-1][y'] + N ] &gt;&gt; (log₂(N) + 1)</span>
                    </div>
                    <div className="math-row">
                      <span className="math-lhs">pred[x, y] =</span>
                      <span className="math-rhs">dcVal &nbsp; (Uniform Flat Average)</span>
                    </div>
                  </div>
                ) : (
                  <div className="math-display" style={{ fontSize: '0.78rem' }}>
                    <div className="math-row">
                      <span className="math-lhs">deltaPos =</span>
                      <span className="math-rhs">(y + 1) · {angle}</span>
                    </div>
                    <div className="math-row">
                      <span className="math-lhs">iIdx =</span>
                      <span className="math-rhs">deltaPos &gt;&gt; 5, &nbsp; iFact = deltaPos &amp; 31</span>
                    </div>
                    <div className="math-row">
                      <span className="math-lhs">pred[x, y] =</span>
                      <span className="math-rhs">
                        iFact ≠ 0 ? [ (32 - iFact)·ref[x+iIdx+1] + iFact·ref[x+iIdx+2] + 16 ] &gt;&gt; 5 : ref[x+iIdx+1]
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* OUTPUT CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
              <span className="process-label">piPred[8×8]</span>
            </div>

            <div className="stage-io-col">
              <span className="io-col-badge" style={{ background: 'var(--c-blue)', color: '#FFF' }}>OUTPUT: PRED BLOCK</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Variable:</strong> <code>piPred</code> (TComPrediction)</div>
                <div className="io-meta-line"><strong>Dimensions:</strong> 8 × 8 (64 Pel)</div>
                <div className="io-meta-line"><strong>Mode:</strong> {modeInfo.name}</div>

                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 16px)', gridTemplateRows: 'repeat(8, 16px)' }}>
                    {predData.map((v, i) => (
                      <div key={i} style={{ backgroundColor: `rgb(${v},${v},${v})`, color: v<128?'#FFF':'#000', fontSize: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {v}
                      </div>
                    ))}
                  </div>
                </div>
                <span className="io-caption">Predicted 8×8 block ready for residual subtraction</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: STAGE 04 DETAIL (EXPLICIT INPUT ---> PROCESS ---> OUTPUT) */}
      {activeTab === 'step4' && (
        <div className="stage-detail-box">
          <div className="stage-detail-header">
            <span className="stage-tag">STAGE 04 DETAIL</span>
            <h3 className="stage-title">Boundary Filtering & Residual Generation</h3>
            <span className="stage-func">HM Codebase: TComPrediction::xDCPredFiltering() & TEncSearch residual subtraction</span>
          </div>

          <div className="stage-io-row">
            {/* INPUT CARD */}
            <div className="stage-io-col">
              <span className="io-col-badge">INPUT: ORG & PRED</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Variable 1:</strong> <code>piOrg</code> (Original 8×8 Block)</div>
                <div className="io-meta-line"><strong>Variable 2:</strong> <code>piPred</code> (Predicted 8×8 Block)</div>
                <div className="io-meta-line"><strong>Edge Filter:</strong> {hasEdgeFilter ? 'Active (Row 0 / Col 0)' : 'Bypass'}</div>

                <div className="io-visual-box" style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700 }}>Original:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 10px)', gridTemplateRows: 'repeat(8, 10px)' }}>
                      {orgData.map((v, i) => (
                        <div key={i} style={{ backgroundColor: `rgb(${v},${v},${v})` }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700 }}>Prediction:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 10px)', gridTemplateRows: 'repeat(8, 10px)' }}>
                      {predData.map((v, i) => (
                        <div key={i} style={{ backgroundColor: `rgb(${v},${v},${v})` }} />
                      ))}
                    </div>
                  </div>
                </div>
                <span className="io-caption">Original texture and prediction model</span>
              </div>
            </div>

            {/* PROCESS CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
              <span className="process-label">Org − Pred</span>
            </div>

            <div className="stage-io-col" style={{ flex: 1.2 }}>
              <span className="io-col-badge" style={{ background: '#000', color: '#FFF' }}>HM C++ PROCESS & FORMULA</span>
              <div className="stage-io-card" style={{ background: '#FFF' }}>
                <div className="formula-badge">Boundary Smoothing & Residual Subtraction</div>
                <div className="math-display" style={{ fontSize: '0.78rem' }}>
                  <div className="math-row">
                    <span className="math-lhs">Residual Matrix:</span>
                    <span className="math-rhs">resi[x, y] = org[x, y] - pred[x, y]</span>
                  </div>
                  {selectedMode === 1 && (
                    <div className="math-row">
                      <span className="math-lhs">DC Corner Filter:</span>
                      <span className="math-rhs">pred[0,0] = (p[0,-1] + p[-1,0] + 2·dcVal + 2) &gt;&gt; 2</span>
                    </div>
                  )}
                  {selectedMode === 26 && (
                    <div className="math-row">
                      <span className="math-lhs">Ver Edge Filter:</span>
                      <span className="math-rhs">pred[0,y] = Clip3(0, 255, pred[0,y] + ((p[-1,y] - p[-1,-1]) &gt;&gt; 1))</span>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '10px', fontSize: '0.74rem', color: '#333', lineHeight: 1.4 }}>
                  • Residual signal represents the remaining error to be transformed (DCT/DST) and quantized.<br />
                  • Total RDO Cost = Distortion + λ · Mode Bits.
                </div>
              </div>
            </div>

            {/* OUTPUT CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
              <span className="process-label">piResi[8×8]</span>
            </div>

            <div className="stage-io-col">
              <span className="io-col-badge" style={{ background: 'var(--c-magenta)', color: '#FFF' }}>OUTPUT: RESIDUAL</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Variable:</strong> <code>piResi</code> (Residual Matrix)</div>
                <div className="io-meta-line"><strong>Dimensions:</strong> 8 × 8 (64 Signed Integers)</div>
                <div className="io-meta-line"><strong>RDO Cost:</strong> {modeData?.cost?.toFixed(1) || '0.0'}</div>

                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 16px)', gridTemplateRows: 'repeat(8, 16px)' }}>
                    {resiData.map((v, i) => {
                      const intensity = Math.min(1, Math.abs(v) / 64);
                      const bg = v === 0 ? '#E6E6E6' : (v > 0 ? `rgba(222,0,106,${intensity})` : `rgba(245,130,32,${intensity})`);
                      return (
                        <div key={i} style={{ backgroundColor: bg, color: intensity>0.5?'#FFF':'#000', fontSize: '0.45rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {v > 0 ? `+${v}` : v}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <span className="io-caption">Signed difference matrix sent to Transform</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntraPredictionFlow;
