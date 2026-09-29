import React, { useState, useEffect } from 'react';
import { getIntraModeInfo } from '../utils/colorUtils';

/**
 * ModeComparisonModal
 * Compares two Intra Prediction candidate modes side-by-side:
 *  - Prediction pixels Pred_A vs Pred_B
 *  - Differential Error Matrix Delta(x, y) = Pred_A - Pred_B
 *  - RD Cost differential & Winner verdict
 */
export default function ModeComparisonModal({
  jobId = null,
  modes = [],
  initialModeA = 0,
  initialModeB = 1,
  isModal = true,
  onClose = null
}) {
  const [modeA, setModeA] = useState(initialModeA);
  const [modeB, setModeB] = useState(initialModeB);
  const [apiCmpData, setApiCmpData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [viewMode, setViewMode] = useState('pred'); // 'pred' or 'resi'

  const localCmpData = React.useMemo(() => {
    const itemA = modes.find(m => m.mode === modeA);
    const itemB = modes.find(m => m.mode === modeB);
    if (!itemA || !itemB || !itemA.pred_data || !itemB.pred_data) return null;

    const diffMatrix = itemA.pred_data.map((pa, idx) => pa - itemB.pred_data[idx]);
    const sadDiff = diffMatrix.reduce((sum, d) => sum + Math.abs(d), 0);
    const costA = itemA.cost || 0;
    const costB = itemB.cost || 0;

    let resiDiffMatrix = null;
    let sseA = null;
    let sseB = null;
    let sseDiff = null;

    if (itemA.resi_data && itemB.resi_data) {
      resiDiffMatrix = itemA.resi_data.map((ra, idx) => ra - itemB.resi_data[idx]);
      sseA = itemA.resi_data.reduce((sum, r) => sum + r * r, 0);
      sseB = itemB.resi_data.reduce((sum, r) => sum + r * r, 0);
      sseDiff = sseB - sseA;
    }

    return {
      mode_a: modeA,
      mode_b: modeB,
      direction_a: getIntraModeInfo(modeA).name,
      direction_b: getIntraModeInfo(modeB).name,
      cost_a: costA,
      cost_b: costB,
      cost_difference: Math.round((costB - costA) * 100) / 100,
      better_mode: costA <= costB ? modeA : modeB,
      pixel_sad_diff: sadDiff,
      pixel_diff_matrix: diffMatrix,
      cu_size: 8,
      resi_diff_matrix: resiDiffMatrix,
      sse_a: sseA,
      sse_b: sseB,
      sse_diff: sseDiff
    };
  }, [modes, modeA, modeB]);

  // Fetch comparison from backend API
  useEffect(() => {
    if (!jobId) return;

    let ignore = false;
    const controller = new AbortController();

    async function fetchComparison() {
      try {
        const res = await fetch(
          `http://localhost:8000/api/v1/checkpoints/${jobId}/CP_03_INTRA_SEARCH/compare?mode_a=${modeA}&mode_b=${modeB}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        if (!ignore) {
          setApiCmpData(data);
          setLoading(false);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn("API comparison failed, falling back to local computation:", err);
          if (!ignore) setLoading(false);
        }
      }
    }

    fetchComparison();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [jobId, modeA, modeB]);

  const cmpData = apiCmpData || localCmpData;

  const itemA = modes.find(m => m.mode === modeA);
  const itemB = modes.find(m => m.mode === modeB);

  // Diverging color for pixel difference
  const getDiffColor = (val) => {
    if (val === 0) return { bg: '#F8FAFC', color: '#94A3B8' };
    const maxVal = 64; // normalize range
    const norm = Math.min(1, Math.abs(val) / maxVal);
    if (val > 0) {
      // Mode A higher than B
      const alpha = 0.2 + norm * 0.7;
      return { bg: `rgba(222, 0, 106, ${alpha})`, color: norm > 0.5 ? '#FFFFFF' : '#000000' };
    } else {
      // Mode B higher than A
      const alpha = 0.2 + norm * 0.7;
      return { bg: `rgba(0, 163, 224, ${alpha})`, color: norm > 0.5 ? '#FFFFFF' : '#000000' };
    }
  };

  // Diverging color for residual difference (Resi A - Resi B)
  const getResiDiffColor = (val) => {
    if (val === 0) return { bg: '#F8FAFC', color: '#94A3B8' };
    const maxVal = 32;
    const norm = Math.min(1, Math.abs(val) / maxVal);
    if (val > 0) {
      const alpha = 0.2 + norm * 0.7;
      return { bg: `rgba(225, 29, 72, ${alpha})`, color: norm > 0.5 ? '#FFFFFF' : '#000000' };
    } else {
      const alpha = 0.2 + norm * 0.7;
      return { bg: `rgba(37, 99, 235, ${alpha})`, color: norm > 0.5 ? '#FFFFFF' : '#000000' };
    }
  };

  // Signed color for residual cells
  const getResiCellColor = (val) => {
    if (val === 0) return { bg: '#F1F5F9', color: '#64748B' };
    const norm = Math.min(1, Math.abs(val) / 32);
    if (val > 0) {
      return { bg: `rgba(225, 29, 72, ${0.15 + norm * 0.7})`, color: norm > 0.5 ? '#FFFFFF' : '#000000' };
    } else {
      return { bg: `rgba(249, 115, 22, ${0.15 + norm * 0.7})`, color: norm > 0.5 ? '#FFFFFF' : '#000000' };
    }
  };

  const comparatorContent = (
    <div style={{
      background: 'var(--c-white)',
      border: isModal ? '3px solid var(--c-black)' : 'none',
      boxShadow: isModal ? '8px 8px 0px rgba(0,0,0,1)' : 'none',
      maxWidth: isModal ? '960px' : '100%',
      width: '100%',
      maxHeight: isModal ? '90vh' : 'none',
      overflowY: isModal ? 'auto' : 'visible',
      padding: isModal ? '1.5rem' : '0',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem'
    }}>
      {/* Header (when modal) */}
      {isModal && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--c-black)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.3rem', textTransform: 'uppercase', fontWeight: 800 }}>
              Mode Differential Comparator
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#666' }}>
              Compare spatial intra predictions & RD cost deltas
            </span>
            {loading && (
              <span style={{ fontSize: '0.8rem', color: 'var(--c-orange)', marginLeft: '1rem', fontWeight: 700 }}>
                Computing comparison...
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '1rem',
              fontWeight: 800,
              background: 'var(--c-black)',
              color: 'var(--c-white)',
              border: 'none',
              cursor: 'pointer'
            }}
            title="Close Modal"
          >
            ✕
          </button>
        </div>
      )}

        {/* Mode Selector Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', background: '#F0F9FF', border: '2px solid var(--c-blue)' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--c-blue)' }}>
              Candidate Mode A:
            </label>
            <select
              value={modeA}
              onChange={(e) => {
                setModeA(Number(e.target.value));
                if (jobId) setLoading(true);
              }}
              style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem', fontWeight: 700, border: '1.5px solid var(--c-black)' }}
            >
              {modes.map(m => (
                <option key={m.mode} value={m.mode}>
                  Mode {m.mode}: {getIntraModeInfo(m.mode).name} (Cost: {Math.round(m.cost || 0)})
                </option>
              ))}
            </select>
          </div>

          <div style={{ padding: '0.75rem', background: '#FDF2F8', border: '2px solid var(--c-magenta)' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--c-magenta)' }}>
              Candidate Mode B:
            </label>
            <select
              value={modeB}
              onChange={(e) => {
                setModeB(Number(e.target.value));
                if (jobId) setLoading(true);
              }}
              style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem', fontWeight: 700, border: '1.5px solid var(--c-black)' }}
            >
              {modes.map(m => (
                <option key={m.mode} value={m.mode}>
                  Mode {m.mode}: {getIntraModeInfo(m.mode).name} (Cost: {Math.round(m.cost || 0)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Result Summary Banner */}
        {cmpData && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            padding: '1rem',
            background: '#F8FAFC',
            border: '2px solid var(--c-black)'
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Winner Mode</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: cmpData.better_mode === modeA ? 'var(--c-blue)' : 'var(--c-magenta)' }}>
                Mode {cmpData.better_mode} ({getIntraModeInfo(cmpData.better_mode).name})
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>Lowest Lagrange Cost</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Cost Delta (B − A)</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: cmpData.cost_difference > 0 ? '#16A34A' : '#DC2626' }}>
                {cmpData.cost_difference > 0 ? `+${cmpData.cost_difference}` : cmpData.cost_difference}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>
                {cmpData.cost_difference > 0 ? 'Mode A is cheaper' : 'Mode B is cheaper'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Pixel SAD Difference</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                {cmpData.pixel_sad_diff}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>Avg diff: {(cmpData.pixel_sad_diff / 64).toFixed(1)} px</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>SSE Distortion (A vs B)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace' }}>
                {cmpData.sse_a ?? '—'} vs {cmpData.sse_b ?? '—'}
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: cmpData.sse_diff !== null && cmpData.sse_diff > 0 ? '#16A34A' : (cmpData.sse_diff < 0 ? '#DC2626' : '#666') }}>
                {cmpData.sse_diff !== null && cmpData.sse_diff !== undefined
                  ? `Δ SSE = ${cmpData.sse_diff > 0 ? '+' + cmpData.sse_diff : cmpData.sse_diff} (${cmpData.sse_diff > 0 ? 'A lower error' : 'B lower error'})`
                  : 'Distortion differential'}
              </div>
            </div>
          </div>
        )}

        {/* View Mode Tabs: Prediction vs Residual */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button
            onClick={() => setViewMode('pred')}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              background: viewMode === 'pred' ? 'var(--c-black)' : 'var(--c-white)',
              color: viewMode === 'pred' ? 'var(--c-white)' : 'var(--c-black)',
              border: '2px solid var(--c-black)',
              cursor: 'pointer'
            }}
          >
            Spatial Prediction (Pred_A vs Pred_B)
          </button>
          <button
            onClick={() => setViewMode('resi')}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              background: viewMode === 'resi' ? 'var(--c-black)' : 'var(--c-white)',
              color: viewMode === 'resi' ? 'var(--c-white)' : 'var(--c-black)',
              border: '2px solid var(--c-black)',
              cursor: 'pointer'
            }}
          >
            Residual & Distortion (Resi_A vs Resi_B)
          </button>
        </div>

        {/* Tri-Matrix Comparison Grids for Spatial Prediction */}
        {viewMode === 'pred' && cmpData && itemA && itemB && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem',
            alignItems: 'flex-start'
          }}>
            {/* Grid 1: Pred A */}
            <div style={{ border: '2px solid var(--c-black)', padding: '0.75rem', background: '#F0F9FF' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--c-blue)' }}>
                Pred A: Mode {modeA}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '2px',
                background: 'var(--c-black)',
                padding: '2px',
                aspectRatio: '1/1'
              }}>
                {(itemA.pred_data || []).map((val, idx) => (
                  <div
                    key={`pa-${idx}`}
                    style={{
                      background: `rgb(${val}, ${val}, ${val})`,
                      color: val > 128 ? '#000' : '#FFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontFamily: 'monospace',
                      fontWeight: 700
                    }}
                  >
                    {val}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                Cost A: {Math.round(cmpData.cost_a)}
              </div>
            </div>

            {/* Grid 2: Difference Matrix Delta */}
            <div style={{ border: '2px solid var(--c-black)', padding: '0.75rem', background: 'var(--c-white)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Δ Matrix (Pred A − Pred B)
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '2px',
                background: 'var(--c-black)',
                padding: '2px',
                aspectRatio: '1/1'
              }}>
                {(cmpData.pixel_diff_matrix || []).map((val, idx) => {
                  const style = getDiffColor(val);
                  return (
                    <div
                      key={`diff-${idx}`}
                      style={{
                        backgroundColor: style.bg,
                        color: style.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontFamily: 'monospace',
                        fontWeight: 700
                      }}
                    >
                      {val > 0 ? `+${val}` : val}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--c-magenta)', fontWeight: 700 }}>A &gt; B (Magenta)</span>
                <span>0 (White)</span>
                <span style={{ color: 'var(--c-blue)', fontWeight: 700 }}>A &lt; B (Cyan)</span>
              </div>
            </div>

            {/* Grid 3: Pred B */}
            <div style={{ border: '2px solid var(--c-black)', padding: '0.75rem', background: '#FDF2F8' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--c-magenta)' }}>
                Pred B: Mode {modeB}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '2px',
                background: 'var(--c-black)',
                padding: '2px',
                aspectRatio: '1/1'
              }}>
                {(itemB.pred_data || []).map((val, idx) => (
                  <div
                    key={`pb-${idx}`}
                    style={{
                      background: `rgb(${val}, ${val}, ${val})`,
                      color: val > 128 ? '#000' : '#FFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontFamily: 'monospace',
                      fontWeight: 700
                    }}
                  >
                    {val}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                Cost B: {Math.round(cmpData.cost_b)}
              </div>
            </div>
          </div>
        )}

        {/* Tri-Matrix Comparison Grids for Residual & SSE Distortion */}
        {viewMode === 'resi' && cmpData && itemA && itemB && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem',
            alignItems: 'flex-start'
          }}>
            {/* Grid 1: Resi A */}
            <div style={{ border: '2px solid var(--c-black)', padding: '0.75rem', background: '#F0FDF4' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', color: '#15803D' }}>
                Resi A: Mode {modeA}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '2px',
                background: 'var(--c-black)',
                padding: '2px',
                aspectRatio: '1/1'
              }}>
                {(itemA.resi_data || Array(64).fill(0)).map((val, idx) => {
                  const style = getResiCellColor(val);
                  return (
                    <div
                      key={`ra-${idx}`}
                      style={{
                        backgroundColor: style.bg,
                        color: style.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontFamily: 'monospace',
                        fontWeight: 700
                      }}
                    >
                      {val > 0 ? `+${val}` : val}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#15803D' }}>
                SSE A: {cmpData.sse_a !== null ? cmpData.sse_a : 'N/A'}
              </div>
            </div>

            {/* Grid 2: Residual Difference (Resi A - Resi B) */}
            <div style={{ border: '2px solid var(--c-black)', padding: '0.75rem', background: 'var(--c-white)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Δ Resi Matrix (Resi A − Resi B)
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '2px',
                background: 'var(--c-black)',
                padding: '2px',
                aspectRatio: '1/1'
              }}>
                {(cmpData.resi_diff_matrix || Array(64).fill(0)).map((val, idx) => {
                  const style = getResiDiffColor(val);
                  return (
                    <div
                      key={`rdiff-${idx}`}
                      style={{
                        backgroundColor: style.bg,
                        color: style.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontFamily: 'monospace',
                        fontWeight: 700
                      }}
                    >
                      {val > 0 ? `+${val}` : val}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--c-magenta)', fontWeight: 700 }}>Resi A &gt; B (Red)</span>
                <span>0 (White)</span>
                <span style={{ color: 'var(--c-blue)', fontWeight: 700 }}>Resi A &lt; B (Blue)</span>
              </div>
            </div>

            {/* Grid 3: Resi B */}
            <div style={{ border: '2px solid var(--c-black)', padding: '0.75rem', background: '#FEF2F2' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', color: '#B91C1C' }}>
                Resi B: Mode {modeB}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '2px',
                background: 'var(--c-black)',
                padding: '2px',
                aspectRatio: '1/1'
              }}>
                {(itemB.resi_data || Array(64).fill(0)).map((val, idx) => {
                  const style = getResiCellColor(val);
                  return (
                    <div
                      key={`rb-${idx}`}
                      style={{
                        backgroundColor: style.bg,
                        color: style.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontFamily: 'monospace',
                        fontWeight: 700
                      }}
                    >
                      {val > 0 ? `+${val}` : val}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#B91C1C' }}>
                SSE B: {cmpData.sse_b !== null ? cmpData.sse_b : 'N/A'}
              </div>
            </div>
          </div>
        )}
      </div>
    );

  if (!isModal) {
    return comparatorContent;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.5rem'
    }}>
      {comparatorContent}
    </div>
  );
}
