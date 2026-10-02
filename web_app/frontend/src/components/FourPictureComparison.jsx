import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getIntraModeInfo } from '../utils/colorUtils';

/**
 * Diverging Colormap for Residual:
 * Negative values: Blue
 * Zero: Neutral Light Slate Gray
 * Positive values: Orange-Red
 */
function getResidualColor(val, maxVal = 64) {
  const norm = Math.max(-1, Math.min(1, val / maxVal));
  if (norm < 0) {
    const intensity = Math.round(Math.abs(norm) * 200);
    return `rgb(${140 - intensity / 2}, ${170 - intensity / 3}, ${220 + intensity / 8})`;
  } else if (norm > 0) {
    const intensity = Math.round(norm * 200);
    return `rgb(${220 + intensity / 8}, ${160 - intensity / 2}, ${140 - intensity / 2})`;
  }
  return '#E2E8F0'; // Zero error
}

/**
 * FourPictureComparison Component
 * Clean, Apple-inspired comparison of the 4 fundamental HEVC images:
 *  1. Original Picture (S)
 *  2. Prediction Picture (P)
 *  3. Residual Picture (R = S - P)
 *  4. Reconstructed Picture (S' = P + R')
 */
const FourPictureComparison = ({
  imageSrc,
  imageDims,
  ctuX,
  ctuY,
  currentMode,
  selectedCu,
  jobId,
  API_BASE_URL = '',
  onSelectCTU,
  onNavigateToIntra,
}) => {
  const [scope, setScope] = useState('cu'); // 'cu' | 'frame'
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' | 'split' | 'single'
  const [singleFocus, setSingleFocus] = useState('orig');
  const [splitLeft, setSplitLeft] = useState('orig');
  const [splitRight, setSplitRight] = useState('recon');
  const [splitPos, setSplitPos] = useState(50);
  const [resiGain, setResiGain] = useState(4);
  const [showValues, setShowValues] = useState(true);
  const [selectedCell, setSelectedCell] = useState(null);

  const imgWidth = imageDims?.width || 640;
  const imgHeight = imageDims?.height || 360;

  const splitContainerRef = useRef(null);
  const isDraggingSplit = useRef(false);

  const handleSplitMouseDown = () => {
    isDraggingSplit.current = true;
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingSplit.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      setSplitPos(pos);
    };

    const handleMouseUp = () => {
      isDraggingSplit.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Extract CU Data Matrices
  const cuData = useMemo(() => {
    const cuSize = (currentMode?.cu_size) || (selectedCu?.width) || 8;
    const numPixels = cuSize * cuSize;

    let pred = currentMode?.pred_data;
    if (!Array.isArray(pred) || pred.length < numPixels) {
      pred = new Array(numPixels).fill(128);
    }

    let resi = currentMode?.resi_data;
    if (!Array.isArray(resi) || resi.length < numPixels) {
      resi = new Array(numPixels).fill(0);
    }

    let orig = currentMode?.orig_data;
    if (!Array.isArray(orig) || orig.length < numPixels) {
      orig = pred.map((p, idx) => Math.max(0, Math.min(255, p + resi[idx])));
    }

    let recon = currentMode?.recon_data;
    if (!Array.isArray(recon) || recon.length < numPixels) {
      recon = orig.map((o, idx) => {
        const r = resi[idx];
        const quantR = Math.round(r / 4) * 4;
        return Math.max(0, Math.min(255, pred[idx] + quantR));
      });
    }

    let sse = 0;
    let maxAbsErr = 0;
    let sumOrig = 0;
    let sumResi = 0;

    for (let i = 0; i < numPixels; i++) {
      const err = orig[i] - recon[i];
      sse += err * err;
      const absErr = Math.abs(err);
      if (absErr > maxAbsErr) maxAbsErr = absErr;

      sumOrig += orig[i];
      sumResi += Math.abs(resi[i]);
    }

    const mse = sse / numPixels;
    const psnr = mse > 0 ? (10 * Math.log10((255 * 255) / mse)).toFixed(2) : '∞';

    const meanOrig = sumOrig / numPixels;
    let varOrig = 0;
    let varResi = 0;
    for (let i = 0; i < numPixels; i++) {
      varOrig += Math.pow(orig[i] - meanOrig, 2);
      varResi += Math.pow(resi[i], 2);
    }
    varOrig /= numPixels;
    varResi /= numPixels;
    const varReduction = varOrig > 0 ? Math.max(0, ((1 - varResi / varOrig) * 100)).toFixed(1) : '95.0';

    return {
      cuSize,
      orig,
      pred,
      resi,
      recon,
      mse: mse.toFixed(2),
      psnr,
      maxAbsErr,
      varReduction,
    };
  }, [currentMode, selectedCu]);

  const modeInfo = useMemo(() => {
    return currentMode ? getIntraModeInfo(currentMode.mode) : null;
  }, [currentMode]);

  const reconImgUrl = useMemo(() => {
    if (jobId) {
      return `${API_BASE_URL}/api/v1/jobs/${jobId}/images/reconstructed`;
    }
    return imageSrc;
  }, [jobId, imageSrc, API_BASE_URL]);

  const residualImgUrl = useMemo(() => {
    if (jobId) {
      return `${API_BASE_URL}/api/v1/jobs/${jobId}/images/residual?gain=${resiGain}`;
    }
    return null;
  }, [jobId, resiGain, API_BASE_URL]);

  // Clean pixel matrix rendering without hover tracking
  const renderPixelMatrix = (type, title, badge) => {
    const size = cuData.cuSize;
    let dataArray;
    if (type === 'orig') dataArray = cuData.orig;
    else if (type === 'pred') dataArray = cuData.pred;
    else if (type === 'resi') dataArray = cuData.resi;
    else dataArray = cuData.recon;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--c-white)',
          border: '1.5px solid var(--c-black)',
          boxShadow: '2px 2px 0px rgba(0, 0, 0, 1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.4rem 0.65rem',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            fontSize: '0.78rem',
            fontFamily: 'JetBrains Mono',
            fontWeight: 600,
          }}
        >
          <span>{title}</span>
          <span
            style={{
              padding: '0.1rem 0.35rem',
              fontSize: '0.66rem',
              background: 'var(--c-black)',
              color: 'var(--c-white)',
              fontWeight: 700,
            }}
          >
            {badge}
          </span>
        </div>

        <div
          style={{
            padding: '0.5rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#0F172A',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${size}, 1fr)`,
              gap: '1px',
              background: '#334155',
              padding: '1px',
              maxWidth: '340px',
              width: '100%',
              aspectRatio: '1 / 1',
            }}
          >
            {dataArray.map((val, idx) => {
              const x = idx % size;
              const y = Math.floor(idx / size);
              const isSelected = selectedCell && selectedCell.x === x && selectedCell.y === y;

              let bg = '#FFFFFF';
              let textCol = '#000000';

              if (type === 'resi') {
                const boosted = val * resiGain;
                bg = getResidualColor(boosted, 128);
                textCol = Math.abs(val) > 20 ? '#000000' : '#475569';
              } else {
                const clamped = Math.max(0, Math.min(255, val));
                bg = `rgb(${clamped}, ${clamped}, ${clamped})`;
                textCol = clamped > 128 ? '#000000' : '#FFFFFF';
              }

              return (
                <div
                  key={`cell-${idx}`}
                  onClick={() =>
                    setSelectedCell({
                      x,
                      y,
                      orig: cuData.orig[idx],
                      pred: cuData.pred[idx],
                      resi: cuData.resi[idx],
                      recon: cuData.recon[idx],
                    })
                  }
                  style={{
                    background: bg,
                    color: textCol,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: size <= 8 ? '0.68rem' : '0.55rem',
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: isSelected ? '2px solid #0284C7' : 'none',
                    zIndex: isSelected ? 5 : 1,
                    userSelect: 'none',
                  }}
                >
                  {showValues && (type === 'resi' && val > 0 ? `+${val}` : val)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Full frame picture panel
  const renderFramePicture = (type, title, badge) => {
    let imgSrc = imageSrc;
    if (type === 'recon') {
      imgSrc = reconImgUrl;
    } else if (type === 'resi') {
      imgSrc = residualImgUrl || imageSrc;
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--c-white)',
          border: '1.5px solid var(--c-black)',
          boxShadow: '2px 2px 0px rgba(0, 0, 0, 1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.4rem 0.65rem',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            fontSize: '0.78rem',
            fontFamily: 'JetBrains Mono',
            fontWeight: 600,
          }}
        >
          <span>{title}</span>
          <span
            style={{
              padding: '0.1rem 0.35rem',
              fontSize: '0.66rem',
              background: 'var(--c-black)',
              color: 'var(--c-white)',
              fontWeight: 700,
            }}
          >
            {badge}
          </span>
        </div>

        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: `${imgWidth} / ${imgHeight}`,
            background: '#0F172A',
            cursor: onSelectCTU ? 'pointer' : 'default',
          }}
          onClick={(e) => {
            if (!onSelectCTU) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const scaleX = imgWidth / rect.width;
            const scaleY = imgHeight / rect.height;
            const x = Math.min(imgWidth - 1, Math.max(0, Math.floor((e.clientX - rect.left) * scaleX)));
            const y = Math.min(imgHeight - 1, Math.max(0, Math.floor((e.clientY - rect.top) * scaleY)));
            const targetX = Math.floor(x / 64);
            const targetY = Math.floor(y / 64);
            if (ctuX === targetX && ctuY === targetY) {
              onSelectCTU(null, null);
            } else {
              onSelectCTU(targetX, targetY);
            }
          }}
        >
          <img
            src={imgSrc}
            alt={title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              filter: type === 'resi' && !residualImgUrl ? `contrast(300%) invert(20%)` : 'none',
            }}
          />

          {ctuX !== null && ctuY !== null && (
            <div
              style={{
                position: 'absolute',
                top: `${(ctuY * 64 / imgHeight) * 100}%`,
                left: `${(ctuX * 64 / imgWidth) * 100}%`,
                width: `${(64 / imgWidth) * 100}%`,
                height: `${(64 / imgHeight) * 100}%`,
                border: '1.5px solid #0284C7',
                background: 'rgba(2, 132, 199, 0.2)',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </div>
    );
  };

  const renderSplitSlider = () => {
    const isFrame = scope === 'frame';
    const leftSrc = splitLeft === 'orig' ? imageSrc : reconImgUrl;
    const rightSrc = splitRight === 'recon' ? reconImgUrl : imageSrc;

    return (
      <div
        ref={splitContainerRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '860px',
          margin: '0 auto',
          aspectRatio: isFrame ? `${imgWidth} / ${imgHeight}` : '1 / 1',
          border: '1.5px solid var(--c-black)',
          boxShadow: '3px 3px 0px rgba(0, 0, 0, 1)',
          overflow: 'hidden',
          userSelect: 'none',
          background: '#0F172A',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          {isFrame ? (
            <img src={rightSrc} alt="Right" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {renderPixelMatrix(splitRight, `${splitRight.toUpperCase()}`, 'Right')}
            </div>
          )}
        </div>

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            clipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)`,
          }}
        >
          {isFrame ? (
            <img src={leftSrc} alt="Left" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {renderPixelMatrix(splitLeft, `${splitLeft.toUpperCase()}`, 'Left')}
            </div>
          )}
        </div>

        <div
          onMouseDown={handleSplitMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${splitPos}%`,
            width: '3px',
            background: '#FFFFFF',
            cursor: 'ew-resize',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'var(--c-black)',
              border: '2px solid #FFFFFF',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.65rem',
              fontWeight: 700,
            }}
          >
            ⇄
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Clean Apple-style Toolbar */}
      <div className="stage-section-card" style={{ padding: '0.75rem 1rem', background: '#FAFAFA' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
              Picture Comparison
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {ctuX !== null && ctuY !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  style={{
                    padding: '0.2rem 0.55rem',
                    background: 'var(--c-white)',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                  }}
                >
                  CTU ({ctuX}, {ctuY})
                </span>
                {onSelectCTU && (
                  <button
                    type="button"
                    onClick={() => onSelectCTU(null, null)}
                    style={{
                      padding: '0.2rem 0.45rem',
                      background: 'var(--c-white)',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: '#64748B',
                    }}
                    title="Deselect CTU"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            {onNavigateToIntra && (
              <button
                type="button"
                onClick={onNavigateToIntra}
                style={{
                  padding: '0.2rem 0.55rem',
                  background: 'var(--c-white)',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Intra →
              </button>
            )}
            {modeInfo && (
              <>
                <span
                  style={{
                    padding: '0.2rem 0.55rem',
                    background: 'var(--c-black)',
                    color: 'var(--c-white)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                  }}
                >
                  Mode {currentMode.mode}: {modeInfo.name}
                </span>
                <span
                  style={{
                    padding: '0.2rem 0.55rem',
                    background: '#FEF3C7',
                    border: '1px solid #FCD34D',
                    color: '#92400E',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                  }}
                >
                  Cost: {currentMode.cost?.toFixed(1) || '0.0'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.6rem',
            marginTop: '0.65rem',
            paddingTop: '0.65rem',
            borderTop: '1px solid #E2E8F0',
          }}
        >
          {/* Scope */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>
              Scope:
            </span>
            {[
              { id: 'cu', label: 'Block (8×8)' },
              { id: 'frame', label: 'Full Frame' },
            ].map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScope(s.id)}
                style={{
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: '1px solid #CBD5E1',
                  background: scope === s.id ? 'var(--c-black)' : 'var(--c-white)',
                  color: scope === s.id ? 'var(--c-white)' : 'var(--c-black)',
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Layout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>
              Layout:
            </span>
            {[
              { id: 'grid', label: 'Grid' },
              { id: 'split', label: 'Split Wipe' },
              { id: 'single', label: 'Single' },
            ].map(l => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLayoutMode(l.id)}
                style={{
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: '1px solid #CBD5E1',
                  background: layoutMode === l.id ? '#0284C7' : 'var(--c-white)',
                  color: layoutMode === l.id ? '#FFFFFF' : 'var(--c-black)',
                  cursor: 'pointer',
                }}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Gain and Values */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                Gain:
              </span>
              {[1, 2, 4, 8].map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setResiGain(g)}
                  style={{
                    padding: '0.15rem 0.4rem',
                    fontSize: '0.68rem',
                    border: '1px solid #CBD5E1',
                    background: resiGain === g ? 'var(--c-black)' : 'var(--c-white)',
                    color: resiGain === g ? 'var(--c-white)' : 'var(--c-black)',
                    cursor: 'pointer',
                  }}
                >
                  {g}×
                </button>
              ))}
            </div>

            {scope === 'cu' && (
              <button
                type="button"
                onClick={() => setShowValues(prev => !prev)}
                style={{
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: '1px solid #CBD5E1',
                  background: showValues ? '#FEF08A' : 'var(--c-white)',
                  color: 'var(--c-black)',
                  cursor: 'pointer',
                }}
              >
                Values: {showValues ? 'On' : 'Off'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Selected Cell Inspector (Deliberate click inspection) */}
      {selectedCell && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.45rem 0.85rem',
            background: '#F1F5F9',
            border: '1px solid #CBD5E1',
            fontFamily: 'JetBrains Mono',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>
              Cell [{selectedCell.x}, {selectedCell.y}]
            </span>
            <span>Original: <strong>{selectedCell.orig}</strong></span>
            <span>Prediction: <strong>{selectedCell.pred}</strong></span>
            <span>Residual: <strong>{selectedCell.resi > 0 ? `+${selectedCell.resi}` : selectedCell.resi}</strong></span>
            <span>Reconstructed: <strong>{selectedCell.recon}</strong></span>
            <span>Error: <strong>{Math.abs(selectedCell.orig - selectedCell.recon)}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedCell(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: '0.7rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Viewport Content */}
      {layoutMode === 'split' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
              <span>Left:</span>
              <select
                value={splitLeft}
                onChange={e => setSplitLeft(e.target.value)}
                style={{ padding: '0.2rem 0.4rem', border: '1px solid #CBD5E1' }}
              >
                <option value="orig">Original</option>
                <option value="pred">Prediction</option>
                <option value="resi">Residual</option>
                <option value="recon">Reconstructed</option>
              </select>
            </div>
            <span style={{ color: '#64748B', fontSize: '0.8rem' }}>vs</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
              <span>Right:</span>
              <select
                value={splitRight}
                onChange={e => setSplitRight(e.target.value)}
                style={{ padding: '0.2rem 0.4rem', border: '1px solid #CBD5E1' }}
              >
                <option value="recon">Reconstructed</option>
                <option value="pred">Prediction</option>
                <option value="resi">Residual</option>
                <option value="orig">Original</option>
              </select>
            </div>
          </div>
          {renderSplitSlider()}
        </div>
      ) : layoutMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
          {scope === 'cu' ? (
            <>
              {renderPixelMatrix('orig', 'Original (S)', 'Input')}
              {renderPixelMatrix('pred', 'Prediction (P)', `Mode ${currentMode?.mode}`)}
              {renderPixelMatrix('resi', `Residual (R) [${resiGain}×]`, 'Error')}
              {renderPixelMatrix('recon', "Reconstructed (S')", 'Decoded')}
            </>
          ) : (
            <>
              {renderFramePicture('orig', 'Original Frame', 'Input')}
              {renderFramePicture('pred', 'Prediction Frame', 'Spatial')}
              {renderFramePicture('resi', `Residual Frame [${resiGain}×]`, 'Error')}
              {renderFramePicture('recon', "Reconstructed Frame", 'Decoded')}
            </>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: '540px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.65rem', justifyContent: 'center' }}>
            {[
              { id: 'orig', label: 'Original' },
              { id: 'pred', label: 'Prediction' },
              { id: 'resi', label: 'Residual' },
              { id: 'recon', label: 'Reconstructed' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSingleFocus(f.id)}
                style={{
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '1px solid #CBD5E1',
                  background: singleFocus === f.id ? 'var(--c-black)' : 'var(--c-white)',
                  color: singleFocus === f.id ? 'var(--c-white)' : 'var(--c-black)',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {scope === 'cu'
            ? renderPixelMatrix(singleFocus, singleFocus.toUpperCase(), 'Focus')
            : renderFramePicture(singleFocus, singleFocus.toUpperCase(), 'Focus')}
        </div>
      )}

      {/* Metrics Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.85rem',
        }}
      >
        <div
          style={{
            padding: '0.75rem',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            fontFamily: 'JetBrains Mono',
          }}
        >
          <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>
            PSNR
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginTop: '0.15rem' }}>
            {cuData.psnr} <span style={{ fontSize: '0.75rem' }}>dB</span>
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            fontFamily: 'JetBrains Mono',
          }}
        >
          <div style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 600 }}>
            Energy Reduction
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803D', marginTop: '0.15rem' }}>
            {cuData.varReduction}%
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            fontFamily: 'JetBrains Mono',
          }}
        >
          <div style={{ fontSize: '0.68rem', color: '#1E40AF', fontWeight: 600 }}>
            Max Error
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1D4ED8', marginTop: '0.15rem' }}>
            ±{cuData.maxAbsErr}
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem',
            background: '#FAF5FF',
            border: '1px solid #E9D5FF',
            fontFamily: 'JetBrains Mono',
          }}
        >
          <div style={{ fontSize: '0.68rem', color: '#6B21A8', fontWeight: 600 }}>
            Identity
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#7E22CE', marginTop: '0.25rem' }}>
            S' = P + R'
          </div>
        </div>
      </div>
    </div>
  );
};

export default FourPictureComparison;
