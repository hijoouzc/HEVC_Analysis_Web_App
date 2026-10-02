import React, { useState, useMemo, useCallback } from 'react';
import { getIntraModeInfo, getSampleColorAndTextColor, getResidualColorAndTextColor, SELECTION_HIGHLIGHT_COLOR } from '../utils/colorUtils';

/**
 * Synchronized4WayViewport
 * Synchronized 4-Way Crosshair Viewport across:
 * [1] Original: Reference block texture (Y / Cb / Cr)
 * [2] Prediction: Model prediction from intra mode
 * [3] Residual Heatmap: Signed error matrix (0 = Neutral, + = Red/Warm, - = Blue/Cool)
 * [4] Reconstruction: Restored block (Clip3[0, 255, Pred + Resi])
 *
 * Fully dynamic block sizing (8×8, 16×16, 32×32) and channel selection (Y, Cb, Cr).
 */
export default function Synchronized4WayViewport({
  modeData = null,
  currentMode = 0,
  _blockSize = 8,
  ctuX = 0,
  ctuY = 0,
  onBackToIntra = null
}) {
  const [channel, setChannel] = useState('Y'); // 'Y', 'U', 'V'
  const [selectedPixel, setSelectedPixel] = useState({ r: 0, c: 0 }); // click-only inspection
  const [layoutMode, setLayoutMode] = useState('2x2'); // '2x2' or 'side-by-side'
  const [showValues, setShowValues] = useState(true);
  const [zoomPreset, setZoomPreset] = useState('fit'); // 'fit', '1.5x', '2x'

  const handleChannelChange = useCallback((newCh) => {
    setChannel(newCh);
    setSelectedPixel(null);
  }, []);

  // Target block size based on selected channel (ITU-T H.265 4:2:0 subsampling)
  // Strictly enforce 8x8 for Luma and 4x4 for Chroma
  const targetN = (channel === 'Y') ? 8 : 4;
  const N = targetN;
  const totalPixels = N * N;

  // Extract memoized raw arrays based on selected channel
  const orgData = useMemo(() => {
    const raw = channel === 'U' ? modeData?.org_u : channel === 'V' ? modeData?.org_v : modeData?.org_data;
    return (raw && raw.length >= totalPixels) ? raw.slice(0, totalPixels) : Array(totalPixels).fill(128);
  }, [channel, modeData, totalPixels]);

  const predData = useMemo(() => {
    const raw = channel === 'U' ? modeData?.pred_u : channel === 'V' ? modeData?.pred_v : modeData?.pred_data;
    return (raw && raw.length >= totalPixels) ? raw.slice(0, totalPixels) : Array(totalPixels).fill(128);
  }, [channel, modeData, totalPixels]);

  const resiData = useMemo(() => {
    const raw = channel === 'U' ? modeData?.resi_u : channel === 'V' ? modeData?.resi_v : modeData?.resi_data;
    return (raw && raw.length >= totalPixels) ? raw.slice(0, totalPixels) : Array(totalPixels).fill(0);
  }, [channel, modeData, totalPixels]);

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

  // Dynamic cell sizing based on N to prevent viewport overflow
  const cellSize = useMemo(() => {
    let base = Math.max(9, Math.floor(320 / N));
    if (zoomPreset === '1.5x') base = Math.round(base * 1.4);
    if (zoomPreset === '2x') base = Math.round(base * 1.8);
    return Math.max(8, base);
  }, [N, zoomPreset]);

  const showCellText = showValues && cellSize >= 15;

  // Dynamic max scale for residual heatmap
  const heatmapScale = Math.max(16, stats.maxAbsResi);

  // Residual Heatmap color generator
  const getResidualStyle = (val) => {
    return getResidualColorAndTextColor(val, heatmapScale);
  };

  const getSampleStyle = (val) => {
    return getSampleColorAndTextColor(val, channel);
  };

  // Helper to render an individual matrix grid
  const renderMatrix = (type, dataArray, title, subtitle, badgeColor) => {
    return (
      <div style={{
        background: 'var(--c-white)',
        border: '2px solid var(--c-black)',
        boxShadow: '3px 3px 0px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: `${N * cellSize + 32}px`
      }}>
        {/* Sub-card Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.45rem 0.75rem',
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
              fontFamily: 'JetBrains Mono'
            }}>
              {title}
            </span>
          </div>
          {subtitle && (
            <span style={{
              fontSize: '0.72rem',
              color: '#444',
              fontFamily: 'JetBrains Mono',
              fontWeight: 600
            }}>
              {subtitle}
            </span>
          )}
        </div>

        {/* Matrix Grid Container */}
        <div style={{
          padding: '0.85rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#F8FAFC',
          border: '1px solid #CBD5E1',
          overflow: 'auto'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${N}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${N}, ${cellSize}px)`,
            gap: '1px',
            background: '#CBD5E1',
            border: '2px solid var(--c-black)',
            position: 'relative'
          }}>
            {dataArray.map((val, idx) => {
              const c = idx % N;
              const r = Math.floor(idx / N);
              const validR = selectedPixel ? Math.min(Math.max(0, selectedPixel.r), N - 1) : null;
              const validC = selectedPixel ? Math.min(Math.max(0, selectedPixel.c), N - 1) : null;
              const isSelected = selectedPixel !== null && validR === r && validC === c;

              let cellBg = '';
              let cellColor = '';
              let cellBorder = 'none';
              let cellShadow = 'none';

              if (type === 'resi') {
                const resiStyle = getResidualStyle(val);
                cellBg = resiStyle.bg;
                cellColor = resiStyle.color;
                cellBorder = resiStyle.border;
                cellShadow = resiStyle.textShadow;
              } else {
                const sStyle = getSampleStyle(val);
                cellBg = sStyle.bg;
                cellColor = sStyle.color;
                cellBorder = sStyle.border;
                cellShadow = sStyle.textShadow;
              }

              return (
                <div
                  key={`cell-${type}-${r}-${c}`}
                  onClick={() => {
                    setSelectedPixel(prev => {
                      if (prev && prev.r === r && prev.c === c) {
                        return null;
                      }
                      return { r, c };
                    });
                  }}
                  style={{
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    backgroundColor: cellBg,
                    color: cellColor,
                    textShadow: cellShadow,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: cellSize >= 36 ? '0.74rem' : cellSize >= 22 ? '0.60rem' : '0.45rem',
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 700,
                    cursor: 'pointer',
                    userSelect: 'none',
                    border: isSelected ? `2px solid ${SELECTION_HIGHLIGHT_COLOR}` : cellBorder,
                    boxShadow: 'none',
                    transform: 'none',
                    zIndex: isSelected ? 20 : 1,
                    transition: 'none',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    boxSizing: 'border-box'
                  }}
                  title={`[${type.toUpperCase()}] Row ${r}, Col ${c} = ${val}`}
                >
                  {(showCellText || (isSelected && cellSize >= 12)) && (
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

  const activeR = selectedPixel ? Math.min(Math.max(0, selectedPixel.r), N - 1) : null;
  const activeC = selectedPixel ? Math.min(Math.max(0, selectedPixel.c), N - 1) : null;
  const activeOrg = selectedPixel ? orgData[activeR * N + activeC] : null;
  const activePred = selectedPixel ? predData[activeR * N + activeC] : null;
  const activeResi = selectedPixel ? resiData[activeR * N + activeC] : null;
  const activeRecon = selectedPixel ? reconData[activeR * N + activeC] : null;

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
          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>
            Synchronized 4-Way Viewport
          </span>
          <span style={{
            fontSize: '0.8rem',
            color: '#64748B',
            fontFamily: 'JetBrains Mono',
            fontWeight: 600
          }}>
            CTU ({ctuX}, {ctuY}) • Mode {activeMode} • {channel} {N}×{N}
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

          {/* Channel Selector Toggle */}
          <div style={{ display: 'flex', border: '1.5px solid var(--c-black)', background: '#F1F5F9', padding: '2px' }}>
            <button
              type="button"
              onClick={() => handleChannelChange('Y')}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono',
                border: 'none',
                background: channel === 'Y' ? 'var(--c-black)' : 'transparent',
                color: channel === 'Y' ? '#FFFFFF' : 'var(--c-black)',
                cursor: 'pointer'
              }}
            >
              Y
            </button>
            <button
              type="button"
              onClick={() => handleChannelChange('U')}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono',
                border: 'none',
                background: channel === 'U' ? '#0284C7' : 'transparent',
                color: channel === 'U' ? '#FFFFFF' : '#0284C7',
                cursor: 'pointer'
              }}
            >
              Cb
            </button>
            <button
              type="button"
              onClick={() => handleChannelChange('V')}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono',
                border: 'none',
                background: channel === 'V' ? '#E11D48' : 'transparent',
                color: channel === 'V' ? '#FFFFFF' : '#E11D48',
                cursor: 'pointer'
              }}
            >
              Cr
            </button>
          </div>

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
            {layoutMode === '2x2' ? '2×2' : '4-Column'}
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
            Values: {showValues ? 'On' : 'Off'}
          </button>

          {/* Zoom Buttons */}
          <div style={{ display: 'flex', border: '2px solid var(--c-black)' }}>
            {['fit', '1.5x', '2x'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setZoomPreset(mode)}
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono',
                  border: 'none',
                  borderRight: mode !== '2x' ? '1px solid var(--c-black)' : 'none',
                  background: zoomPreset === mode ? 'var(--c-blue)' : 'var(--c-white)',
                  color: zoomPreset === mode ? '#FFFFFF' : '#000000',
                  cursor: 'pointer'
                }}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Pixel Synchronized Readout Banner */}
      <div style={{
        background: selectedPixel ? '#FFFBEB' : '#F8FAFC',
        border: selectedPixel ? '2px solid #F59E0B' : '1px solid #E2E8F0',
        padding: '0.65rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        fontFamily: 'JetBrains Mono',
        fontSize: '0.82rem',
        transition: 'none'
      }}>
        {selectedPixel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, color: '#B45309' }}>
              Pixel ({activeR}, {activeC}):
            </span>
            <span>Original: <strong>{activeOrg}</strong></span>
            <span>Prediction: <strong style={{ color: 'var(--c-blue)' }}>{activePred}</strong></span>
            <span>Residual: <strong style={{ color: activeResi > 0 ? '#E11D48' : activeResi < 0 ? '#0284C7' : '#475569' }}>
              {activeResi > 0 ? `+${activeResi}` : activeResi}
            </strong></span>
            <span>Reconstructed: <strong style={{ color: '#16A34A' }}>{activeRecon}</strong></span>
          </div>
        ) : (
          <div style={{ color: '#64748B', fontSize: '0.78rem' }}>
            Click any pixel to inspect synchronized values across all 4 views
          </div>
        )}
      </div>

      {/* Viewport Matrices Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: layoutMode === '2x2' ? 'repeat(auto-fit, minmax(320px, 1fr))' : `repeat(4, minmax(${N * cellSize + 40}px, 1fr))`,
        gap: '1.25rem',
        marginBottom: '1.25rem',
        overflowX: 'auto'
      }}>
        {/* Viewport 1: Original */}
        {renderMatrix(
          'org',
          orgData,
          `Original (${channel})`,
          '',
          '#10B981'
        )}

        {/* Viewport 2: Prediction */}
        {renderMatrix(
          'pred',
          predData,
          `Prediction (${channel})`,
          `Mode ${activeMode}: ${modeInfo.name}`,
          '#0284C7'
        )}

        {/* Viewport 3: Residual Heatmap */}
        {renderMatrix(
          'resi',
          resiData,
          `Residual (${channel})`,
          `±${heatmapScale}`,
          '#E11D48'
        )}

        {/* Viewport 4: Reconstruction */}
        {renderMatrix(
          'recon',
          reconData,
          `Reconstructed (${channel})`,
          '',
          '#8B5CF6'
        )}
      </div>

      {/* Block Statistics & Metric Summary Footer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.75rem',
        padding: '0.85rem 1rem',
        background: 'var(--c-light-gray)',
        border: '1.5px solid var(--c-black)',
        fontFamily: 'JetBrains Mono',
        fontSize: '0.78rem'
      }}>
        <div>
          <span style={{ color: '#666', display: 'block', fontSize: '0.68rem', textTransform: 'uppercase' }}>Dimension</span>
          <strong>{channel} {N}×{N}</strong>
        </div>
        <div>
          <span style={{ color: '#666', display: 'block', fontSize: '0.68rem', textTransform: 'uppercase' }}>SAD</span>
          <strong style={{ color: 'var(--c-magenta)' }}>{stats.sad}</strong>
        </div>
        <div>
          <span style={{ color: '#666', display: 'block', fontSize: '0.68rem', textTransform: 'uppercase' }}>SSE</span>
          <strong style={{ color: 'var(--c-orange)' }}>{stats.sse}</strong>
        </div>
        <div>
          <span style={{ color: '#666', display: 'block', fontSize: '0.68rem', textTransform: 'uppercase' }}>PSNR</span>
          <strong style={{ color: '#10B981' }}>{stats.psnr} dB</strong>
        </div>
        <div>
          <span style={{ color: '#666', display: 'block', fontSize: '0.68rem', textTransform: 'uppercase' }}>Max Residual</span>
          <strong style={{ color: '#E11D48' }}>±{stats.maxAbsResi}</strong>
        </div>
        <div>
          <span style={{ color: '#666', display: 'block', fontSize: '0.68rem', textTransform: 'uppercase' }}>Zero Residuals</span>
          <strong>{stats.zeroCount} / {totalPixels}</strong>
        </div>
      </div>
    </div>
  );
}
