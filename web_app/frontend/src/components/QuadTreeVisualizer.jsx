import React, { useState } from 'react';
import { getIntraModeInfo } from '../utils/colorUtils';

/**
 * QuadTreeVisualizer (CP_01_PARTITION)
 * Renders the recursive CTU Quadtree partitioning structure down to leaf CUs
 */
export default function QuadTreeVisualizer({
  partitionData = null,
  ctuX = 0,
  ctuY = 0,
  onSelectCU = null,
  onNavigateToIntra = null,
  onBackToFrame = null
}) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [colorScheme, setColorScheme] = useState('mode'); // 'mode' (default), 'depth'

  if (!partitionData || !partitionData.nodes || partitionData.nodes.length === 0) {
    return (
      <div className="card-box" style={{ padding: '2rem', textAlign: 'center', background: 'var(--c-light-gray)' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>CP_01: CTU QuadTree Partitioning</h3>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          No partition trace data available for CTU ({ctuX}, {ctuY}). Encode an image to view the quadtree hierarchy.
        </p>
      </div>
    );
  }

  const { nodes, total_nodes, leaf_nodes, max_depth, split_count } = partitionData;

  // Base CTU offset in pixels safely determined from partitionData or props
  const targetCtuX = partitionData.ctu_x !== undefined ? partitionData.ctu_x : ctuX;
  const targetCtuY = partitionData.ctu_y !== undefined ? partitionData.ctu_y : ctuY;
  const ctuPixelX = targetCtuX * 64;
  const ctuPixelY = targetCtuY * 64;

  const leafNodes = nodes.filter(n => !n.split);
  const splitNodes = nodes.filter(n => n.split);

  // Depth color palettes matching H.265 quadtree hierarchy
  const depthColors = {
    0: { bg: 'rgba(2, 132, 199, 0.18)', border: '#0284C7', text: '#0369A1', label: 'Depth 0 (64×64)' },
    1: { bg: 'rgba(14, 165, 233, 0.18)', border: '#0EA5E9', text: '#0284C7', label: 'Depth 1 (32×32)' },
    2: { bg: 'rgba(249, 115, 22, 0.18)', border: '#F97316', text: '#C2410C', label: 'Depth 2 (16×16)' },
    3: { bg: 'rgba(234, 179, 8, 0.18)', border: '#EAB308', text: '#A16207', label: 'Depth 3 (8×8)' },
  };

  // Prediction Mode color palettes (H.265 standard)
  const modeColors = {
    INTRA: { bg: 'rgba(220, 38, 38, 0.18)', border: '#DC2626', text: '#B91C1C', label: 'Intra (#DC2626)' },
    INTER: { bg: 'rgba(37, 99, 235, 0.18)', border: '#2563EB', text: '#1D4ED8', label: 'Inter (#2563EB)' },
    SKIP:  { bg: 'rgba(22, 163, 74, 0.18)', border: '#16A34A', text: '#15803D', label: 'Skip (#16A34A)' },
  };

  // Safe relative coordinate helper eliminating NaN and coordinate misalignment
  const getSafeRelCoord = (val, basePixel) => {
    if (typeof val !== 'number' || isNaN(val)) return 0;
    if (val >= basePixel && val < basePixel + 64) {
      return val - basePixel;
    }
    if (val < 64) {
      return val;
    }
    return val % 64;
  };

  const activeNode = hoveredNode || selectedNode || leafNodes[0];

  return (
    <div className="quadtree-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Navigation & Level Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onBackToFrame && (
            <button
              type="button"
              onClick={onBackToFrame}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono',
                border: '1.5px solid var(--c-black)',
                background: 'var(--c-white)',
                cursor: 'pointer'
              }}
              title="Return to full frame view"
            >
              ← BACK TO FRAME VIEW
            </button>
          )}
          <span style={{ fontSize: '0.85rem', fontWeight: 800, fontFamily: 'JetBrains Mono' }}>
            [LEVEL 2: CTU ({targetCtuX}, {targetCtuY}) QUADTREE]
          </span>
        </div>

        {activeNode && onNavigateToIntra && (
          <button
            type="button"
            onClick={() => onNavigateToIntra(activeNode)}
            style={{
              padding: '0.35rem 0.85rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              fontFamily: 'JetBrains Mono',
              border: '1.5px solid var(--c-black)',
              background: 'var(--c-magenta)',
              color: '#FFFFFF',
              cursor: 'pointer'
            }}
          >
            INSPECT INTRA PREDICTION ({activeNode.width}×{activeNode.height}) →
          </button>
        )}
      </div>

      {/* Top Stats Banner */}
      <div className="metrics-banner" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '1rem',
        padding: '1rem 1.25rem',
        background: 'var(--c-white)',
        border: '2px solid var(--c-black)'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#666', fontWeight: 700 }}>CTU Target</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>({targetCtuX}, {targetCtuY})</div>
          <div style={{ fontSize: '0.75rem', color: '#888' }}>Origin: {ctuPixelX}, {ctuPixelY} px</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#666', fontWeight: 700 }}>Leaf CUs</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--c-blue)' }}>{leaf_nodes || leafNodes.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#888' }}>Total nodes: {total_nodes}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#666', fontWeight: 700 }}>Max Depth</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--c-orange)' }}>{max_depth} / 3</div>
          <div style={{ fontSize: '0.75rem', color: '#888' }}>Splits: {split_count}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#666', fontWeight: 700 }}>CU Size Range</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>64 → 8 px</div>
          <div style={{ fontSize: '0.75rem', color: '#888' }}>Quadtree Z-scan</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Color By:</span>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              onClick={() => setColorScheme('mode')}
              style={{
                flex: 1,
                padding: '0.3rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1.5px solid var(--c-black)',
                background: colorScheme === 'mode' ? 'var(--c-black)' : 'var(--c-white)',
                color: colorScheme === 'mode' ? 'var(--c-white)' : 'var(--c-black)',
                cursor: 'pointer'
              }}
            >
              Mode
            </button>
            <button
              onClick={() => setColorScheme('depth')}
              style={{
                flex: 1,
                padding: '0.3rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1.5px solid var(--c-black)',
                background: colorScheme === 'depth' ? 'var(--c-black)' : 'var(--c-white)',
                color: colorScheme === 'depth' ? 'var(--c-white)' : 'var(--c-black)',
                cursor: 'pointer'
              }}
            >
              Depth
            </button>
          </div>
        </div>
      </div>

      {/* Main Visualizer Body */}
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Interactive 64x64 Quadtree Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '480px', flex: '1 1 360px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>
              64×64 CTU Spatial QuadTree Layout
            </span>
            <span style={{ fontSize: '0.75rem', color: '#666' }}>
              Click CU to select
            </span>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '480px',
              aspectRatio: '1 / 1',
              background: '#F8FAFC',
              border: '3px solid var(--c-black)',
              boxShadow: '4px 4px 0px rgba(0,0,0,1)',
              userSelect: 'none',
              boxSizing: 'border-box'
            }}
          >
            {/* Split boundary indicators (subtle guide lines) */}
            {splitNodes.map((s, idx) => {
              const safeRelX = getSafeRelCoord(s.x, ctuPixelX);
              const safeRelY = getSafeRelCoord(s.y, ctuPixelY);
              const relX = (safeRelX / 64) * 100;
              const relY = (safeRelY / 64) * 100;
              const w = ((s.width || 64) / 64) * 100;
              const h = ((s.height || 64) / 64) * 100;
              return (
                <div
                  key={`split-${idx}`}
                  style={{
                    position: 'absolute',
                    left: `${relX}%`,
                    top: `${relY}%`,
                    width: `${w}%`,
                    height: `${h}%`,
                    border: '1px dashed rgba(0,0,0,0.25)',
                    pointerEvents: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              );
            })}

            {/* Leaf CUs */}
            {leafNodes.map((node, idx) => {
              const safeRelX = getSafeRelCoord(node.x, ctuPixelX);
              const safeRelY = getSafeRelCoord(node.y, ctuPixelY);
              const relX = (safeRelX / 64) * 100;
              const relY = (safeRelY / 64) * 100;
              const w = ((node.width || 64) / 64) * 100;
              const h = ((node.height || 64) / 64) * 100;

              const isSelected = selectedNode && selectedNode.x === node.x && selectedNode.y === node.y && selectedNode.width === node.width;
              const isHovered = hoveredNode && hoveredNode.x === node.x && hoveredNode.y === node.y && hoveredNode.width === node.width;

              const depthStyle = depthColors[node.depth] || depthColors[3];
              const modeStyle = modeColors[(node.mode || 'INTRA').toUpperCase()] || modeColors.INTRA;
              const activeColor = colorScheme === 'depth' ? depthStyle : modeStyle;

              const showLabel = node.width >= 16;
              const isIntra = (node.mode || 'INTRA').toUpperCase() === 'INTRA';
              const intraLabel = isIntra && node.intra_dir !== null && node.intra_dir !== undefined ? `M${node.intra_dir}` : (node.mode || '');

              return (
                <div
                  key={`leaf-${idx}`}
                  onClick={() => {
                    setSelectedNode(node);
                    if (onSelectCU) onSelectCU(node);
                  }}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{
                    position: 'absolute',
                    left: `${relX}%`,
                    top: `${relY}%`,
                    width: `${w}%`,
                    height: `${h}%`,
                    backgroundColor: activeColor.bg,
                    border: isSelected 
                      ? '3px solid var(--c-magenta)' 
                      : (isHovered ? '2px solid #FFD200' : `1.5px solid ${activeColor.border}`),
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '2px',
                    transition: 'all 0.15s ease',
                    zIndex: isSelected ? 10 : (isHovered ? 5 : 1),
                    boxShadow: isSelected ? '0 0 10px rgba(222,0,106,0.5)' : 'none'
                  }}
                  title={`CU ${node.width}×${node.height} @ (${node.x}, ${node.y}), Mode: ${node.mode || 'INTRA'}${isIntra && node.intra_dir !== null ? ` (M${node.intra_dir})` : ''}, Depth: ${node.depth}`}
                >
                  {showLabel && (
                    <span style={{
                      fontSize: node.width >= 32 ? '0.85rem' : '0.68rem',
                      fontWeight: 800,
                      color: activeColor.text,
                      lineHeight: '1.1',
                      textAlign: 'center'
                    }}>
                      {node.width}×{node.height}
                    </span>
                  )}
                  {showLabel && intraLabel && (
                    <span style={{
                      fontSize: node.width >= 32 ? '0.75rem' : '0.62rem',
                      fontWeight: 800,
                      color: '#1E293B',
                      maxWidth: '95%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                      marginTop: '1px'
                    }}>
                      {intraLabel}
                    </span>
                  )}
                  {node.width === 64 && node.cost !== null && (
                    <span style={{
                      fontSize: '0.7rem',
                      color: '#555',
                      fontFamily: 'monospace',
                      marginTop: '2px'
                    }}>
                      Cost: {Math.round(node.cost)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dynamic Legend (Prediction Modes / Depths) */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#444' }}>
              {colorScheme === 'mode' ? 'PRED MODES:' : 'DEPTH LEVELS:'}
            </span>
            {colorScheme === 'mode' ? (
              Object.entries(modeColors).map(([m, item]) => (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '12px', height: '12px', background: item.bg, border: `1.5px solid ${item.border}`, display: 'inline-block' }} />
                  <span style={{ fontWeight: 600 }}>{m}</span>
                </div>
              ))
            ) : (
              Object.entries(depthColors).map(([d, item]) => (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '12px', height: '12px', background: item.bg, border: `1.5px solid ${item.border}`, display: 'inline-block' }} />
                  <span>{item.label}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected CU Details Inspector Panel */}
        <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card-box" style={{
            background: 'var(--c-white)',
            border: '2px solid var(--c-black)',
            padding: '1.25rem',
            boxShadow: '3px 3px 0px rgba(0,0,0,1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid var(--c-black)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', textTransform: 'uppercase' }}>CU Inspector</h3>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                background: activeNode ? depthColors[activeNode.depth]?.bg : 'transparent',
                border: '1.5px solid var(--c-black)'
              }}>
                Depth {activeNode?.depth}
              </span>
            </div>

            {activeNode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', background: 'var(--c-light-gray)', border: '1px solid #ccc' }}>
                    <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Dimensions</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{activeNode.width} × {activeNode.height} px</div>
                  </div>
                  <div style={{ padding: '0.5rem', background: 'var(--c-light-gray)', border: '1px solid #ccc' }}>
                    <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Position (X, Y)</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>({activeNode.x}, {activeNode.y})</div>
                  </div>
                </div>

                <div style={{ padding: '0.75rem', background: 'var(--c-white)', border: '1.5px solid var(--c-black)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Prediction Mode & Direction
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--c-blue)' }}>
                    {activeNode.mode || 'INTRA'}
                    {activeNode.mode === 'INTRA' && activeNode.intra_dir !== null && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem', color: 'var(--c-black)', fontWeight: 600 }}>
                        Mode {activeNode.intra_dir}: {getIntraModeInfo(activeNode.intra_dir).name} ({getIntraModeInfo(activeNode.intra_dir).type})
                      </span>
                    )}
                  </div>
                  {activeNode.mode === 'INTRA' && activeNode.intra_dir !== null && (
                    <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '0.25rem' }}>
                      {getIntraModeInfo(activeNode.intra_dir).desc}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', background: 'var(--c-light-gray)', border: '1px solid #ccc' }}>
                    <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Quantization QP</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{activeNode.qp ?? 32}</div>
                  </div>
                  <div style={{ padding: '0.5rem', background: 'var(--c-light-gray)', border: '1px solid #ccc' }}>
                    <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>RD Total Cost</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--c-magenta)' }}>
                      {activeNode.cost !== null ? Number(activeNode.cost).toFixed(1) : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Educational Note */}
                <div style={{
                  padding: '0.75rem',
                  background: '#F0FDF4',
                  border: '1.5px solid #16A34A',
                  fontSize: '0.78rem',
                  lineHeight: '1.4',
                  color: '#166534'
                }}>
                  <strong>HEVC Quadtree Logic:</strong> The encoder chose this CU block size after evaluating all 4 sub-quadrants versus keeping the parent block unified, selecting the option with minimum Rate-Distortion cost: <em>J = Distortion + λ × Rate</em>.
                </div>

                {onNavigateToIntra && (
                  <button
                    type="button"
                    onClick={() => onNavigateToIntra(activeNode)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      background: 'var(--c-magenta)',
                      color: '#FFFFFF',
                      border: '2px solid var(--c-black)',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      fontFamily: 'JetBrains Mono',
                      cursor: 'pointer',
                      boxShadow: '3px 3px 0px rgba(0,0,0,1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      marginTop: '0.25rem'
                    }}
                  >
                    INSPECT INTRA PREDICTION (MODE {activeNode.intra_dir ?? 0}, {activeNode.width}×{activeNode.height}) →
                  </button>
                )}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                Select a CU node in the canvas to inspect its parameters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
