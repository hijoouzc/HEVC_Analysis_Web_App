import React, { useState, useMemo } from 'react';
import { getIntraModeInfo } from '../utils/colorUtils';

/**
 * Synchronized4WayViewport (Cải tiến 2)
 * Synchronized 4-Way Viewport:
 * [1] Original: Pixel gốc của khối (Y)
 * [2] Prediction: Pixel dự đoán từ Intra mode
 * [3] Residual Heatmap: Bản đồ nhiệt phần dư (0 = Đen, + = Đỏ rực, - = Xanh lam)
 * [4] Reconstruction: Tái tạo (Pred + Resi clip [0..255])
 *
 * Full Crosshair synchronization across all 4 viewports on pixel hover.
 */
export default function Synchronized4WayViewport({
  modeData = null,
  currentMode = 0,
  blockSize = 8,
  ctuX = 0,
  ctuY = 0,
  onBackToIntra = null
}) {
  const [hoveredPixel, setHoveredPixel] = useState(null); // { r, c }
  const [layoutMode, setLayoutMode] = useState('2x2'); // '2x2' or 'side-by-side'
  const [showValues, setShowValues] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(40); // 32px, 40px, 48px

  const N = blockSize || 8;
  const totalPixels = N * N;

  const orgData = modeData?.org_data || Array(totalPixels).fill(128);
  const predData = modeData?.pred_data || Array(totalPixels).fill(128);
  const resiData = modeData?.resi_data || Array(totalPixels).fill(0);
  const activeMode = modeData?.mode ?? currentMode ?? 0;
  const modeInfo = getIntraModeInfo(activeMode);

  // Compute Reconstruction: Pred + Resi clipped to [0, 255]
  const reconData = useMemo(() => {
    return predData.map((pred, i) => {
      const resi = resiData[i] ?? 0;
      return Math.max(0, Math.min(255, Math.round(pred + resi)));
    });
  }, [predData, resiData]);

  // Compute block-level statistics
  const stats = useMemo(() => {
    let sad = 0;
    let sse = 0;
    let maxAbsResi = 0;
    let zeroCount = 0;

    for (let i = 0; i < totalPixels; i++) {
      const resi = resiData[i] ?? 0;
      const absR = Math.abs(resi);
      sad += absR;
      sse += resi * resi;
      if (absR > maxAbsResi) maxAbsResi = absR;
      if (resi === 0) zeroCount++;
    }

    const meanOrg = Math.round(orgData.reduce((a, b) => a + b, 0) / totalPixels);
    const meanPred = Math.round(predData.reduce((a, b) => a + b, 0) / totalPixels);
    const psnr = sse > 0 ? (10 * Math.log10((255 * 255 * totalPixels) / sse)).toFixed(2) : '∞';

    return { sad, sse, maxAbsResi, zeroCount, meanOrg, meanPred, psnr };
  }, [orgData, predData, resiData, totalPixels]);

  // Dynamic max scale for residual heatmap (clipped to at least 16 for vibrant contrast)
  const heatmapScale = Math.max(16, stats.maxAbsResi);

  // Residual Heatmap color generator
  const getResidualStyle = (val) => {
    if (val === 0) {
      return {
        bg: '#141414',
        color: '#666666',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      };
    }

    const ratio = Math.min(1, Math.abs(val) / heatmapScale);

    if (val > 0) {
      // Lệch dương (+): Đỏ rực (Red/Warm)
      const r = Math.round(190 + 65 * ratio);
      const g = Math.round(20 * (1 - ratio));
      const b = Math.round(45 * (1 - ratio));
      return {
        bg: `rgba(${r}, ${g}, ${b}, ${0.4 + 0.6 * ratio})`,
        color: '#FFFFFF',
        border: `1px solid rgba(255, 70, 95, ${0.5 + 0.5 * ratio})`
      };
    } else {
      // Lệch âm (-): Xanh lam (Blue/Cool)
      const r = Math.round(0);
      const g = Math.round(135 + 65 * ratio);
      const b = Math.round(205 + 50 * ratio);
      return {
        bg: `rgba(${r}, ${g}, ${b}, ${0.4 + 0.6 * ratio})`,
        color: '#FFFFFF',
        border: `1px solid rgba(0, 180, 255, ${0.5 + 0.5 * ratio})`
      };
    }
  };

  // Helper to render an individual 8x8 matrix grid
  const renderMatrix = (type, dataArray, title, subtitle, badgeColor) => {
    return (
      <div style={{
        background: 'var(--c-white)',
        border: '2px solid var(--c-black)',
        boxShadow: '3px 3px 0px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Sub-card Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.6rem 0.85rem',
          borderBottom: '2px solid var(--c-black)',
          background: 'var(--c-light-gray)'
        }}>
          <div>
            <span style={{
              background: badgeColor,
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '0.2rem 0.5rem',
              marginRight: '0.5rem',
              fontFamily: 'JetBrains Mono'
            }}>
              {title}
            </span>
          </div>
          <span style={{
            fontSize: '0.72rem',
            color: '#444',
            fontFamily: 'JetBrains Mono',
            fontWeight: 600
          }}>
            {subtitle}
          </span>
        </div>

        {/* Matrix Grid Container */}
        <div style={{
          padding: '0.85rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: type === 'resi' ? '#0d0d0d' : '#222222',
          overflow: 'auto'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${N}, ${zoomLevel}px)`,
            gridTemplateRows: `repeat(${N}, ${zoomLevel}px)`,
            gap: '1px',
            background: type === 'resi' ? '#222' : '#333',
            border: '2px solid var(--c-black)',
            position: 'relative'
          }}>
            {dataArray.map((val, idx) => {
              const c = idx % N;
              const r = Math.floor(idx / N);
              const isHovered = hoveredPixel && hoveredPixel.r === r && hoveredPixel.c === c;

              let cellBg = '';
              let cellColor = '';
              let cellBorder = 'none';

              if (type === 'resi') {
                const resiStyle = getResidualStyle(val);
                cellBg = resiStyle.bg;
                cellColor = resiStyle.color;
                cellBorder = resiStyle.border;
              } else {
                // Grayscale [0..255]
                cellBg = `rgb(${val}, ${val}, ${val})`;
                cellColor = val < 128 ? '#FFFFFF' : '#000000';
              }

              return (
                <div
                  key={`cell-${type}-${r}-${c}`}
                  onMouseEnter={() => setHoveredPixel({ r, c })}
                  onMouseLeave={() => setHoveredPixel(null)}
                  style={{
                    width: `${zoomLevel}px`,
                    height: `${zoomLevel}px`,
                    backgroundColor: cellBg,
                    color: cellColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: zoomLevel >= 48 ? '0.78rem' : zoomLevel >= 40 ? '0.68rem' : '0.58rem',
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 700,
                    cursor: 'crosshair',
                    userSelect: 'none',
                    border: isHovered ? '2px solid #FFD200' : cellBorder,
                    boxShadow: isHovered ? '0 0 0 2px #000, 0 0 8px #FFD200' : 'none',
                    transform: isHovered ? 'scale(1.12)' : 'none',
                    zIndex: isHovered ? 20 : 1,
                    transition: 'transform 0.08s ease, box-shadow 0.08s ease'
                  }}
                  title={`[${type.toUpperCase()}] Row ${r}, Col ${c} = ${val}`}
                >
                  {showValues && (
                    <span>
                      {type === 'resi' && val > 0 ? `+${val}` : val}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const hoveredOrg = hoveredPixel ? orgData[hoveredPixel.r * N + hoveredPixel.c] : null;
  const hoveredPred = hoveredPixel ? predData[hoveredPixel.r * N + hoveredPixel.c] : null;
  const hoveredResi = hoveredPixel ? resiData[hoveredPixel.r * N + hoveredPixel.c] : null;
  const hoveredRecon = hoveredPixel ? reconData[hoveredPixel.r * N + hoveredPixel.c] : null;

  return (
    <div className="synchronized-4way-card" style={{
      background: 'var(--c-white)',
      border: '2px solid var(--c-black)',
      padding: '1.25rem',
      marginBottom: '1.5rem',
      boxShadow: '4px 4px 0px rgba(0,0,0,0.1)'
    }}>
      {/* Top Banner & Control Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: '2px solid var(--c-light-gray)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            background: 'var(--c-magenta)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '0.85rem',
            padding: '0.3rem 0.65rem',
            letterSpacing: '0.05em'
          }}>
            [MULTI-VIEWPORT]
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            Synchronized 4-Way Analysis Viewport
          </span>
          <span style={{
            fontSize: '0.82rem',
            color: '#555',
            fontFamily: 'JetBrains Mono',
            fontWeight: 600
          }}>
            CTU ({ctuX}, {ctuY}) • Mode {activeMode} ({modeInfo.name}) — {N}×{N} Block
          </span>
        </div>

        {/* Viewport Control Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onBackToIntra && (
            <button
              type="button"
              onClick={onBackToIntra}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono',
                border: '1.5px solid var(--c-black)',
                background: 'var(--c-white)',
                cursor: 'pointer'
              }}
              title="Return to Intra Prediction Pipeline"
            >
              ← INTRA PIPELINE
            </button>
          )}

          {/* Layout Toggle */}
          <button
            type="button"
            onClick={() => setLayoutMode(prev => prev === '2x2' ? 'side-by-side' : '2x2')}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              border: '2px solid var(--c-black)',
              background: 'var(--c-white)',
              cursor: 'pointer'
            }}
            title="Toggle between 2×2 Grid and 4-Column Side-by-Side layout"
          >
            LAYOUT: {layoutMode === '2x2' ? '2×2 GRID' : 'SIDE-BY-SIDE'}
          </button>

          {/* Show Numbers Toggle */}
          <button
            type="button"
            onClick={() => setShowValues(prev => !prev)}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              border: '2px solid var(--c-black)',
              background: showValues ? 'var(--c-black)' : 'var(--c-white)',
              color: showValues ? 'var(--c-white)' : 'var(--c-black)',
              cursor: 'pointer'
            }}
            title="Toggle pixel numerical text overlay"
          >
            VALUES: {showValues ? 'ON' : 'OFF'}
          </button>

          {/* Zoom Buttons */}
          <div style={{ display: 'flex', border: '2px solid var(--c-black)' }}>
            {[32, 40, 48].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setZoomLevel(size)}
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono',
                  border: 'none',
                  borderRight: size !== 48 ? '1px solid var(--c-black)' : 'none',
                  background: zoomLevel === size ? 'var(--c-blue)' : 'var(--c-white)',
                  color: zoomLevel === size ? '#FFFFFF' : '#000000',
                  cursor: 'pointer'
                }}
              >
                {size === 32 ? '1x' : size === 40 ? '1.5x' : '2x'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4-Way Viewport Grid Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: layoutMode === '2x2' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
        gap: '1.25rem',
        marginBottom: '1rem'
      }}>
        {/* Viewport 1: Original */}
        {renderMatrix('org', orgData, '1. ORIGINAL', `Mean: ${stats.meanOrg}`, '#0284C7')}

        {/* Viewport 2: Prediction */}
        {renderMatrix('pred', predData, '2. PREDICTION', `Mean: ${stats.meanPred}`, '#0D9488')}

        {/* Viewport 3: Residual Heatmap */}
        {renderMatrix('resi', resiData, '3. RESIDUAL (HEATMAP)', `Range: -${stats.maxAbsResi} .. +${stats.maxAbsResi}`, '#DE006A')}

        {/* Viewport 4: Reconstruction */}
        {renderMatrix('recon', reconData, '4. RECONSTRUCTION', `PSNR: ${stats.psnr} dB`, '#16A34A')}
      </div>

      {/* Residual Heatmap Color Legend Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        padding: '0.5rem 0.85rem',
        background: '#181818',
        color: '#FFFFFF',
        fontFamily: 'JetBrains Mono',
        fontSize: '0.75rem',
        border: '1px solid #333',
        marginBottom: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <strong style={{ color: '#00A3E0' }}>HEATMAP:</strong>
          <span style={{ color: '#00A3FF' }}>[-] Negative (-{heatmapScale})</span>
          <div style={{
            width: '120px',
            height: '10px',
            background: 'linear-gradient(to right, rgb(0, 163, 255), #121212 50%, rgb(255, 30, 80))',
            borderRadius: '2px',
            border: '1px solid #444'
          }} />
          <span style={{ color: '#FF3366' }}>[+] Positive (+{heatmapScale})</span>
          <span style={{ color: '#888', marginLeft: '0.5rem' }}>[0 = Perfect Match]</span>
        </div>

        <div style={{ color: '#AAA' }}>
          Zero Residuals: <strong>{stats.zeroCount}/{totalPixels}</strong> ({(stats.zeroCount / totalPixels * 100).toFixed(1)}% exact match)
        </div>
      </div>

      {/* Synchronized Hover Crosshair Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: hoveredPixel ? '#FFFBEB' : 'var(--c-light-gray)',
        border: hoveredPixel ? '2px solid #F59E0B' : '1px solid var(--c-silver)',
        fontFamily: 'JetBrains Mono',
        fontSize: '0.82rem',
        transition: 'all 0.1s ease'
      }}>
        {hoveredPixel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: '#666' }}>TARGET PIXEL: </span>
              <strong style={{ color: '#000', fontSize: '0.95rem' }}>
                [Row {hoveredPixel.r}, Col {hoveredPixel.c}]
              </strong>
            </div>
            <div>
              <span style={{ color: '#0284C7' }}>ORIGINAL: </span>
              <strong>{hoveredOrg}</strong>
            </div>
            <div>
              <span style={{ color: '#0D9488' }}>PRED: </span>
              <strong>{hoveredPred}</strong>
            </div>
            <div>
              <span style={{ color: hoveredResi > 0 ? '#DE006A' : hoveredResi < 0 ? '#00A3E0' : '#666' }}>
                RESIDUAL (Δ): 
              </span>
              <strong>{hoveredResi > 0 ? `+${hoveredResi}` : hoveredResi}</strong>
            </div>
            <div>
              <span style={{ color: '#16A34A' }}>RECON: </span>
              <strong>{hoveredRecon}</strong>
            </div>
            <div>
              <span style={{ color: '#666' }}>ERROR: </span>
              <strong>{hoveredOrg - hoveredRecon}</strong>
            </div>
          </div>
        ) : (
          <div style={{ color: '#666', fontFamily: 'JetBrains Mono' }}>
            [CROSSHAIR HOVER] Inspect synchronized pixel across all 4 viewports
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', color: '#444', fontSize: '0.78rem' }}>
          <span>SAD: <strong>{stats.sad}</strong></span>
          <span>SSE: <strong>{stats.sse}</strong></span>
          <span>PSNR: <strong>{stats.psnr} dB</strong></span>
        </div>
      </div>
    </div>
  );
}
