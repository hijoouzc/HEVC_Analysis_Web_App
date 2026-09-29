import React, { useState } from 'react';

/**
 * TransformQuantVisualizer (CP_06_TRANSFORM & CP_07_QUANT)
 * Displays:
 *  1. Spatial Residual Matrix R(x, y)
 *  2. 2D DCT/DST Frequency Spectrum & Energy Compaction Ratio
 *  3. Quantized Levels QCoeff & Sparsity Ratio Analysis
 */
export default function TransformQuantVisualizer({
  transformData = [],
  quantData = [],
  ctuX = 0,
  ctuY = 0,
  targetTuX = undefined,
  targetTuY = undefined
}) {
  const [activeComp, setActiveComp] = useState('Y'); // 'Y', 'Cb', 'Cr'
  const [userSelectedTuIdx, setUserSelectedTuIdx] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null); // { x, y }

  // Filter events by selected component (supporting either transformData or quantData)
  const allEvents = (transformData && transformData.length > 0) ? transformData : (quantData || []);
  const filteredEvents = allEvents.filter(e => e.component === activeComp);

  // Sync with targetTuX and targetTuY if provided, or use user override
  const targetIdx = (targetTuX !== undefined && targetTuY !== undefined && filteredEvents.length > 0)
    ? filteredEvents.findIndex(e => e.tu_x === targetTuX && e.tu_y === targetTuY)
    : -1;

  const selectedTuIdx = (userSelectedTuIdx !== null && userSelectedTuIdx < filteredEvents.length)
    ? userSelectedTuIdx
    : (targetIdx !== -1 ? targetIdx : 0);

  const activeEvent = filteredEvents[selectedTuIdx] || filteredEvents[0];

  if (!activeEvent) {
    return (
      <div className="card-box" style={{ padding: '2rem', textAlign: 'center', background: 'var(--c-light-gray)' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>CP_06 & CP_07: Transform & Quantization</h3>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          No Transform or Quantization trace events found for component {activeComp}.
        </p>
      </div>
    );
  }

  const {
    width = 8,
    height = 8,
    qp = 32,
    tu_x = 0,
    tu_y = 0,
    resi_matrix = [],
    dct_coeff = [],
    quant_coeff = [],
    sig_coeff_count = 0,
    dc_coeff = 0,
    energy_compaction_ratio = 0,
    sparsity_ratio = 0
  } = activeEvent;

  // H.265 Section 8.7.2: 4x4 Luma Intra uses Discrete Sine Transform (DST-VII); all other sizes use DCT-II
  const isDst = (width === 4 && height === 4 && activeComp === 'Y');
  const transformName = isDst ? '2D DST-VII' : '2D DCT-II';

  // Max magnitude for DCT/DST spectrum coloring
  const maxDctMag = dct_coeff.reduce((max, c) => Math.max(max, Math.abs(c)), 1);
  const maxResiMag = resi_matrix.reduce((max, r) => Math.max(max, Math.abs(r)), 1);

  // Helper color functions
  const getResiColor = (val) => {
    if (val === 0) return { bg: '#FFFFFF', color: '#888' };
    const norm = Math.min(1, Math.abs(val) / (maxResiMag || 1));
    if (val > 0) {
      // Positive: Soft Red/Orange
      const alpha = 0.15 + norm * 0.75;
      return { bg: `rgba(239, 68, 68, ${alpha})`, color: norm > 0.5 ? '#FFFFFF' : '#000000' };
    } else {
      // Negative: Soft Blue
      const alpha = 0.15 + norm * 0.75;
      return { bg: `rgba(59, 130, 246, ${alpha})`, color: norm > 0.5 ? '#FFFFFF' : '#000000' };
    }
  };

  const getDctColor = (val, isDC) => {
    if (isDC) {
      return { bg: '#00A3E0', color: '#FFFFFF', fontWeight: 800 };
    }
    if (val === 0) {
      return { bg: '#F8FAFC', color: '#CBD5E1', fontWeight: 400 };
    }
    const norm = Math.min(1, Math.abs(val) / (maxDctMag || 1));
    const alpha = 0.12 + norm * 0.75;
    return { bg: `rgba(141, 198, 63, ${alpha})`, color: norm > 0.6 ? '#FFFFFF' : '#000000', fontWeight: 700 };
  };

  const getQuantColor = (val) => {
    if (val === 0) {
      return { bg: '#F8FAFC', color: '#94A3B8', isZero: true };
    }
    const isMajor = Math.abs(val) > 2;
    return {
      bg: isMajor ? 'var(--c-magenta)' : '#FCE7F3',
      color: isMajor ? '#FFFFFF' : '#9D174D',
      isZero: false
    };
  };

  const zeroCoeffCount = (width * height) - sig_coeff_count;
  const sparsityPercent = (sparsity_ratio * 100).toFixed(1);
  const energyPercent = (energy_compaction_ratio * 100).toFixed(1);

  return (
    <div className="transform-quant-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Component & TU Selector Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '0.85rem 1.25rem',
        background: 'var(--c-white)',
        border: '2px solid var(--c-black)'
      }}>
        {/* Component Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginRight: '0.5rem' }}>
            Color Component:
          </span>
          {['Y', 'Cb', 'Cr'].map(comp => (
            <button
              key={comp}
              onClick={() => {
                setActiveComp(comp);
                setUserSelectedTuIdx(0);
              }}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: '2px solid var(--c-black)',
                background: activeComp === comp ? 'var(--c-black)' : 'var(--c-white)',
                color: activeComp === comp ? 'var(--c-white)' : 'var(--c-black)',
                cursor: 'pointer'
              }}
            >
              {comp === 'Y' ? 'Luma (Y)' : comp === 'Cb' ? 'Chroma (Cb)' : 'Chroma (Cr)'}
            </button>
          ))}
        </div>

        {/* TU Block Selector */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
            TU Instance:
          </span>
          <select
            value={selectedTuIdx}
            onChange={(e) => setUserSelectedTuIdx(Number(e.target.value))}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: '2px solid var(--c-black)',
              background: 'var(--c-white)',
              cursor: 'pointer'
            }}
          >
            {filteredEvents.map((ev, idx) => (
              <option key={idx} value={idx}>
                TU #{idx + 1} @ ({ev.tu_x}, {ev.tu_y}) — {ev.width}×{ev.height} px
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="metrics-banner" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        padding: '1rem 1.25rem',
        background: 'var(--c-white)',
        border: '2px solid var(--c-black)'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#666', fontWeight: 700 }}>Transform Unit</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{width} × {height} ({activeComp})</div>
          <div style={{ fontSize: '0.75rem', color: '#888' }}>Offset: ({tu_x}, {tu_y}) in CTU ({ctuX}, {ctuY}) | QP: {qp}</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#666', fontWeight: 700 }}>Energy Compaction</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--c-blue)' }}>{energyPercent}%</div>
          <div style={{ fontSize: '0.75rem', color: '#888' }}>DC = {dc_coeff} (Harmonic 0,0)</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#666', fontWeight: 700 }}>Quantization Sparsity</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--c-magenta)' }}>{sparsityPercent}%</div>
          <div style={{ fontSize: '0.75rem', color: '#888' }}>{zeroCoeffCount} zeros / {width * height} coeffs</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#666', fontWeight: 700 }}>Non-Zero Levels</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16A34A' }}>{sig_coeff_count} coeffs</div>
          <div style={{ fontSize: '0.75rem', color: '#888' }}>CABAC Entropy Target</div>
        </div>
      </div>

      {/* Tri-Matrix Pipeline Comparison View */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        alignItems: 'flex-start'
      }}>
        {/* Matrix 1: Spatial Residual R(x, y) */}
        <div className="card-box" style={{
          background: 'var(--c-white)',
          border: '2px solid var(--c-black)',
          padding: '1.25rem',
          boxShadow: '3px 3px 0px rgba(0,0,0,1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.95rem', textTransform: 'uppercase', fontWeight: 800 }}>
              1. Spatial Residual R(x, y)
            </h4>
            <span style={{ fontSize: '0.75rem', color: '#666' }}>O(x,y) - P(x,y)</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${width}, 1fr)`,
            gap: '2px',
            background: 'var(--c-black)',
            padding: '2px',
            border: '2px solid var(--c-black)',
            aspectRatio: '1/1'
          }}>
            {resi_matrix.map((val, idx) => {
              const x = idx % width;
              const y = Math.floor(idx / width);
              const isHovered = hoveredCell && hoveredCell.x === x && hoveredCell.y === y;
              const style = getResiColor(val);
              return (
                <div
                  key={`resi-${idx}`}
                  onMouseEnter={() => setHoveredCell({ x, y })}
                  onMouseLeave={() => setHoveredCell(null)}
                  style={{
                    backgroundColor: style.bg,
                    color: style.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: width > 8 ? '0.55rem' : '0.72rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    minWidth: 0,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'clip',
                    padding: '1px',
                    outline: isHovered ? '2px solid var(--c-black)' : 'none',
                    zIndex: isHovered ? 5 : 1,
                    userSelect: 'none'
                  }}
                  title={`Residual (${x}, ${y}): ${val}`}
                >
                  {val > 0 ? `+${val}` : val}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#666', marginTop: '0.5rem' }}>
            <span>Negative (Blue)</span>
            <span>Zero (White)</span>
            <span>Positive (Red)</span>
          </div>
        </div>

        {/* Matrix 2: 2D DCT Frequency Spectrum */}
        <div className="card-box" style={{
          background: 'var(--c-white)',
          border: '2px solid var(--c-black)',
          padding: '1.25rem',
          boxShadow: '3px 3px 0px rgba(0,0,0,1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.95rem', textTransform: 'uppercase', fontWeight: 800 }}>
              2. {transformName} Spectrum C(u, v)
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--c-blue)', fontWeight: 700 }}>
              DC = {dc_coeff}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${width}, 1fr)`,
            gap: '2px',
            background: 'var(--c-black)',
            padding: '2px',
            border: '2px solid var(--c-black)',
            aspectRatio: '1/1'
          }}>
            {dct_coeff.map((val, idx) => {
              const u = idx % width;
              const v = Math.floor(idx / width);
              const isDC = (u === 0 && v === 0);
              const isHovered = hoveredCell && hoveredCell.x === u && hoveredCell.y === v;
              const style = getDctColor(val, isDC);
              return (
                <div
                  key={`dct-${idx}`}
                  onMouseEnter={() => setHoveredCell({ x: u, y: v })}
                  onMouseLeave={() => setHoveredCell(null)}
                  style={{
                    backgroundColor: style.bg,
                    color: style.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: width > 8 ? '0.55rem' : '0.72rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: style.fontWeight,
                    minWidth: 0,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'clip',
                    padding: '1px',
                    outline: isHovered ? '2px solid var(--c-black)' : (isDC ? '2px solid #000' : 'none'),
                    zIndex: isHovered ? 5 : 1,
                    userSelect: 'none'
                  }}
                  title={`${isDst ? 'DST' : 'DCT'} (${u}, ${v}) [${isDC ? 'DC' : 'AC'}]: ${val}`}
                >
                  {val}
                </div>
              );
            })}
          </div>

          {/* Energy bar */}
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.2rem' }}>
              <span>DC Harmonic Energy Compaction</span>
              <span>{energyPercent}%</span>
            </div>
            <div style={{ height: '8px', background: '#E2E8F0', border: '1px solid #000' }}>
              <div style={{ width: `${Math.min(100, Math.max(0, energy_compaction_ratio * 100))}%`, height: '100%', background: 'var(--c-blue)' }} />
            </div>
          </div>
        </div>

        {/* Matrix 3: Quantized Coefficients QCoeff */}
        <div className="card-box" style={{
          background: 'var(--c-white)',
          border: '2px solid var(--c-black)',
          padding: '1.25rem',
          boxShadow: '3px 3px 0px rgba(0,0,0,1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.95rem', textTransform: 'uppercase', fontWeight: 800 }}>
              3. Quantized QCoeff(u, v)
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--c-magenta)', fontWeight: 700 }}>
              QP = {qp}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${width}, 1fr)`,
            gap: '2px',
            background: 'var(--c-black)',
            padding: '2px',
            border: '2px solid var(--c-black)',
            aspectRatio: '1/1'
          }}>
            {quant_coeff.map((val, idx) => {
              const u = idx % width;
              const v = Math.floor(idx / width);
              const isHovered = hoveredCell && hoveredCell.x === u && hoveredCell.y === v;
              const style = getQuantColor(val);
              return (
                <div
                  key={`quant-${idx}`}
                  onMouseEnter={() => setHoveredCell({ x: u, y: v })}
                  onMouseLeave={() => setHoveredCell(null)}
                  style={{
                    backgroundColor: style.bg,
                    color: style.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: width > 8 ? '0.55rem' : '0.72rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: style.isZero ? 400 : 800,
                    minWidth: 0,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'clip',
                    padding: '1px',
                    outline: isHovered ? '2px solid var(--c-black)' : 'none',
                    zIndex: isHovered ? 5 : 1,
                    userSelect: 'none'
                  }}
                  title={`QCoeff (${u}, ${v}): ${val}`}
                >
                  {val}
                </div>
              );
            })}
          </div>

          {/* Sparsity bar */}
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.2rem' }}>
              <span>High-Frequency Zero Sparsity Ratio</span>
              <span>{sparsityPercent}%</span>
            </div>
            <div style={{ height: '8px', background: '#E2E8F0', border: '1px solid #000' }}>
              <div style={{ width: `${Math.min(100, Math.max(0, sparsity_ratio * 100))}%`, height: '100%', background: 'var(--c-magenta)' }} />
            </div>
          </div>

          {/* CBF = 0 Indicator */}
          {sig_coeff_count === 0 && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: '#ECFDF5',
              border: '1.5px solid #10B981',
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              <span style={{ color: '#047857', fontWeight: 800, fontSize: '0.8rem' }}>
                CBF_{activeComp} = 0 (All-Zero Block)
              </span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.7rem', color: '#065F46' }}>
                Toàn bộ {width * height} hệ số bị triệt tiêu về 0! CABAC tốn đúng 0 bit cho hệ số biến đổi. Rec = Pred.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Academic RDOQ & Dead-Zone Analysis Banner */}
      <div style={{
        padding: '1rem 1.25rem',
        background: '#FFFFFF',
        border: '1.5px solid #CBD5E1',
        borderRadius: '6px',
        fontSize: '0.8rem',
        lineHeight: '1.6',
        color: '#1E293B'
      }}>
        <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Toán học Lượng tử hóa RDOQ tại QP={qp}:</span>
          {sig_coeff_count === 0 && (
            <span style={{ background: '#10B981', color: '#FFF', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '3px', fontWeight: 700 }}>
              CBF=0 Tối Ưu Nén Cực Đại
            </span>
          )}
        </div>
        <div>
          • <strong>Công thức Lượng tử nguyên HEVC:</strong> <code>|Q| = floor((|Y| × 20560 + f) / 2¹⁹)</code> với hệ số nhân <code>g_quantScales[2] = 20560</code> (QP%6=2) và độ dịch bit <code>14 + 5 = 19</code>.
        </div>
        <div>
          • <strong>Ngưỡng Vùng Chết (Dead-zone Threshold):</strong> Để một hệ số khác 0 (<code>|Q| ≥ 1</code>), độ lớn hệ số biến đổi phải đạt <code>|Y| ≥ (2¹⁹ - f) / 20560 ≈ 17.0</code>.
        </div>
        <div>
          • <strong>Tối ưu hóa Chi phí R-D (RDOQ):</strong> Việc truyền dù chỉ 1 hệ số khác 0 bắt buộc bật cờ <code>cbf_luma = 1</code> và truyền chuỗi cú pháp CABAC tốn 15–25 bit (ΔJ_rate ≈ 350–500). Thuật toán RDOQ của HM chủ động làm tròn toàn bộ hệ số về 0 để đạt chi phí Lagrange J thấp nhất!
        </div>
      </div>
    </div>
  );
}
