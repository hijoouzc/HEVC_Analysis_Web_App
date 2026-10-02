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
  imageSrc = null,
  imageDims = { width: 640, height: 360 },
  selectedCU = null,
  onSelectCU = null,
  onNavigateToIntra = null,
  onBackToFrame = null
}) {
  const [selectedNode, setSelectedNode] = useState(undefined); // undefined: initial load, null: explicitly deselected
  const [colorScheme, setColorScheme] = useState('outline'); // 'outline' (default: clean transparent, no mode overlay), 'mode', 'depth'
  const [textureMode, setTextureMode] = useState('color'); // 'color', 'grayscale', 'off'

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

  const { nodes, leaf_nodes, max_depth } = partitionData;

  // Base CTU offset in pixels safely determined from partitionData or props
  const targetCtuX = partitionData.ctu_x !== undefined ? partitionData.ctu_x : ctuX;
  const targetCtuY = partitionData.ctu_y !== undefined ? partitionData.ctu_y : ctuY;
  const ctuPixelX = targetCtuX * 64;
  const ctuPixelY = targetCtuY * 64;

  const leafNodes = nodes.filter(n => !n.split);
  const splitNodes = nodes.filter(n => n.split);

  // Depth color palettes matching H.265 quadtree hierarchy
  const depthColors = {
    0: { bg: 'rgba(2, 132, 199, 0.22)', bgSolid: '#E0F2FE', border: '#0284C7', text: '#0369A1', label: 'Depth 0 (64×64)' },
    1: { bg: 'rgba(14, 165, 233, 0.22)', bgSolid: '#BAE6FD', border: '#0EA5E9', text: '#0284C7', label: 'Depth 1 (32×32)' },
    2: { bg: 'rgba(249, 115, 22, 0.22)', bgSolid: '#FFEDD5', border: '#F97316', text: '#C2410C', label: 'Depth 2 (16×16)' },
    3: { bg: 'rgba(234, 179, 8, 0.22)', bgSolid: '#FEF08A', border: '#EAB308', text: '#A16207', label: 'Depth 3 (8×8)' },
  };

  // Prediction Mode color palettes (H.265 standard)
  const modeColors = {
    INTRA: { bg: 'rgba(220, 38, 38, 0.22)', bgSolid: '#FEE2E2', border: '#DC2626', text: '#B91C1C', label: 'Intra (#DC2626)' },
    INTER: { bg: 'rgba(37, 99, 235, 0.22)', bgSolid: '#DBEAFE', border: '#2563EB', text: '#1D4ED8', label: 'Inter (#2563EB)' },
    SKIP:  { bg: 'rgba(22, 163, 74, 0.22)', bgSolid: '#DCFCE7', border: '#16A34A', text: '#15803D', label: 'Skip (#16A34A)' },
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

  const activeNode = (() => {
    if (selectedNode !== undefined) {
      if (selectedNode === null) return null; // Explicitly deselected
      const found = leafNodes.find(n => n.x === selectedNode.x && n.y === selectedNode.y && n.width === selectedNode.width);
      return found || null;
    }
    if (selectedCU) {
      const found = leafNodes.find(n => n.x === selectedCU.x && n.y === selectedCU.y && n.width === selectedCU.width);
      if (found) return found;
    }
    return leafNodes.find(n => n.width === 8) || leafNodes[0] || null;
  })();

  // Click handler: click once to select, click again to deselect
  const handleCuClick = (node) => {
    const isCurrentlyActive = activeNode && activeNode.x === node.x && activeNode.y === node.y && activeNode.width === node.width;
    if (isCurrentlyActive) {
      setSelectedNode(null);
      if (onSelectCU) onSelectCU(null);
    } else {
      setSelectedNode(node);
      if (onSelectCU) onSelectCU(node);
    }
  };

  const activeSafeRelX = activeNode ? getSafeRelCoord(activeNode.x, ctuPixelX) : 0;
  const activeSafeRelY = activeNode ? getSafeRelCoord(activeNode.y, ctuPixelY) : 0;
  const activeAbsX = ctuPixelX + activeSafeRelX;
  const activeAbsY = ctuPixelY + activeSafeRelY;
  const activeW = (activeNode && activeNode.width > 0) ? activeNode.width : 64;
  const activeH = (activeNode && activeNode.height > 0) ? activeNode.height : 64;

  const cropBoxSize = 240;

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
              ← Frame View
            </button>
          )}
          <span style={{ fontSize: '0.85rem', fontWeight: 800, fontFamily: 'JetBrains Mono' }}>
            CTU ({targetCtuX}, {targetCtuY}) QuadTree
          </span>
        </div>

        {onNavigateToIntra && (
          activeNode ? (
            <button
              type="button"
              onClick={() => {
                if (activeNode.width === 8) {
                  onNavigateToIntra(activeNode);
                }
              }}
              disabled={activeNode.width !== 8}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.75rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono',
                border: '1.5px solid var(--c-black)',
                background: activeNode.width === 8 ? 'var(--c-magenta)' : '#94A3B8',
                color: '#FFFFFF',
                cursor: activeNode.width === 8 ? 'pointer' : 'not-allowed',
                opacity: activeNode.width === 8 ? 1 : 0.7
              }}
              title={activeNode.width === 8 ? "Inspect 8×8 Intra Prediction Flow" : "Intra prediction pipeline chỉ hỗ trợ phân tích ma trận khối 8×8"}
            >
              {activeNode.width === 8 ? 'Inspect Intra (8×8) →' : `8×8 Only (${activeW}×${activeH})`}
            </button>
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
              No CU selected
            </span>
          )
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
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#666', fontWeight: 700 }}>Leaf CUs</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--c-blue)' }}>{leaf_nodes || leafNodes.length}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#666', fontWeight: 700 }}>Max Depth</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--c-orange)' }}>{max_depth} / 3</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#666', fontWeight: 700 }}>CU Size Range</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>64 → 8 px</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Color Overlay:</span>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              type="button"
              onClick={() => setColorScheme('outline')}
              style={{
                flex: 1,
                padding: '0.3rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1.5px solid var(--c-black)',
                background: colorScheme === 'outline' ? 'var(--c-black)' : 'var(--c-white)',
                color: colorScheme === 'outline' ? 'var(--c-white)' : 'var(--c-black)',
                cursor: 'pointer'
              }}
              title="Clean transparent CU partition lines with NO mode color overlay"
            >
              None
            </button>
            <button
              type="button"
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
              title="Prediction Modes cell overlay: INTRA / INTER / SKIP"
            >
              Mode
            </button>
            <button
              type="button"
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
              title="Quadtree Depth levels overlay: D0..D3"
            >
              Depth
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Texture:</span>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              type="button"
              onClick={() => setTextureMode(m => m === 'color' ? 'grayscale' : m === 'grayscale' ? 'off' : 'color')}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1.5px solid var(--c-black)',
                background: textureMode !== 'off' ? 'var(--c-black)' : 'var(--c-white)',
                color: textureMode !== 'off' ? 'var(--c-white)' : 'var(--c-black)',
                cursor: 'pointer'
              }}
              title="Toggle CTU block texture: COLOR / GRAYSCALE / OFF"
            >
              {textureMode === 'color' ? 'COLOR' : textureMode === 'grayscale' ? 'GRAY' : 'OFF'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Pred Modes:</span>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              type="button"
              onClick={() => setColorScheme(c => c === 'mode' ? 'outline' : 'mode')}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1.5px solid var(--c-black)',
                background: colorScheme === 'mode' ? 'var(--c-magenta)' : 'var(--c-white)',
                color: colorScheme === 'mode' ? 'var(--c-white)' : 'var(--c-black)',
                cursor: 'pointer'
              }}
              title="Toggle PRED MODES cell overlay (INTRA, INTER, SKIP) ON / OFF"
            >
              {colorScheme === 'mode' ? 'OVERLAY: ON' : 'OVERLAY: OFF'}
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
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '480px',
              aspectRatio: '1 / 1',
              background: '#0F172A',
              border: '3px solid var(--c-black)',
              boxShadow: '4px 4px 0px rgba(0,0,0,1)',
              userSelect: 'none',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
            {/* Real CTU 64x64 Image Texture Layer */}
            {imageSrc && textureMode !== 'off' && (
              <svg
                viewBox="0 0 64 64"
                preserveAspectRatio="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 0
                }}
              >
                <image
                  href={imageSrc}
                  x={-ctuPixelX}
                  y={-ctuPixelY}
                  width={imageDims?.width || 640}
                  height={imageDims?.height || 360}
                  preserveAspectRatio="none"
                  style={{
                    imageRendering: 'pixelated',
                    filter: textureMode === 'grayscale' ? 'grayscale(100%)' : 'none'
                  }}
                />
              </svg>
            )}

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
                    border: '1px dashed rgba(255, 255, 255, 0.45)',
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                    zIndex: 1
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

              const isSelected = activeNode && activeNode.x === node.x && activeNode.y === node.y && activeNode.width === node.width;

              const depthStyle = depthColors[node.depth] || depthColors[3];
              const modeStyle = modeColors[(node.mode || 'INTRA').toUpperCase()] || modeColors.INTRA;
              const activeColor = colorScheme === 'depth' ? depthStyle : modeStyle;

              const showLabel = node.width >= 16;
              const isIntra = (node.mode || 'INTRA').toUpperCase() === 'INTRA';
              const intraLabel = isIntra && node.intra_dir !== null && node.intra_dir !== undefined ? `M${node.intra_dir}` : (node.mode || '');

              const hasImage = Boolean(imageSrc && textureMode !== 'off');

              // If colorScheme === 'outline', NO mode color overlay on the cells!
              const cellBg = isSelected
                ? 'rgba(222, 0, 106, 0.40)'
                : (colorScheme === 'outline'
                    ? 'transparent'
                    : (hasImage ? activeColor.bg : activeColor.bgSolid));

              const cellBorder = isSelected
                ? '3px solid var(--c-magenta)'
                : (colorScheme === 'outline'
                    ? (hasImage ? '1.5px solid rgba(255, 255, 255, 0.85)' : '1.5px solid rgba(148, 163, 184, 0.8)')
                    : `1.5px solid ${activeColor.border}`);

              return (
                <div
                  key={`leaf-${idx}`}
                  onClick={() => handleCuClick(node)}
                  style={{
                    position: 'absolute',
                    left: `${relX}%`,
                    top: `${relY}%`,
                    width: `${w}%`,
                    height: `${h}%`,
                    backgroundColor: cellBg,
                    border: cellBorder,
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    opacity: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '2px',
                    transition: 'none',
                    zIndex: isSelected ? 10 : 2,
                    boxShadow: 'none'
                  }}
                  title={`CU ${node.width}×${node.height} @ (${node.x}, ${node.y}), Mode: ${node.mode || 'INTRA'}${isIntra && node.intra_dir !== null ? ` (M${node.intra_dir})` : ''}, Depth: ${node.depth}`}
                >
                  {showLabel && (
                    <span style={{
                      fontSize: node.width >= 32 ? '0.85rem' : '0.68rem',
                      fontWeight: 800,
                      color: hasImage ? '#FFFFFF' : (colorScheme === 'outline' ? '#1E293B' : activeColor.text),
                      textShadow: hasImage ? '0 1px 2px #000, 0 0 4px #000' : 'none',
                      lineHeight: '1.1',
                      textAlign: 'center'
                    }}>
                      {node.width}×{node.height}
                    </span>
                  )}
                  {showLabel && intraLabel && colorScheme === 'mode' && (
                    <span style={{
                      fontSize: node.width >= 32 ? '0.75rem' : '0.62rem',
                      fontWeight: 800,
                      color: hasImage ? '#FFD200' : '#1E293B',
                      textShadow: hasImage ? '0 1px 2px #000, 0 0 4px #000' : 'none',
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
                      color: hasImage ? '#E2E8F0' : '#555',
                      textShadow: hasImage ? '0 1px 2px #000' : 'none',
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

          {/* Dynamic Legend (Prediction Modes / Depths / Clean Outline) */}
          {colorScheme === 'outline' ? (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.72rem' }}>
                <span style={{ color: '#555', fontWeight: 800 }}>OVERLAY:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#1E293B' }}>
                  <span style={{ width: '14px', height: '0px', borderTop: '2px solid rgba(71, 85, 105, 0.95)', display: 'inline-block' }} />
                  <span>CU BOUNDARIES (TRANSPARENT, MODE OVERLAY: OFF)</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setColorScheme('mode')}
                style={{
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono',
                  border: '1px solid var(--c-black)',
                  background: 'var(--c-white)',
                  color: 'var(--c-black)',
                  cursor: 'pointer'
                }}
                title="Turn on PRED MODES cell overlay (INTRA, INTER, SKIP)"
              >
                + TURN ON MODE OVERLAY
              </button>
            </div>
          ) : colorScheme === 'mode' ? (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#444' }}>
                  PRED MODES:
                </span>
                {Object.entries(modeColors).map(([m, item]) => (
                  <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                    <span style={{ width: '12px', height: '12px', background: item.bg, border: `1.5px solid ${item.border}`, display: 'inline-block' }} />
                    <span style={{ fontWeight: 600 }}>{m}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setColorScheme('outline')}
                style={{
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono',
                  border: '1px solid var(--c-black)',
                  background: 'var(--c-white)',
                  color: 'var(--c-black)',
                  cursor: 'pointer'
                }}
                title="Turn off PRED MODES cell overlay"
              >
                ✕ TURN OFF OVERLAY
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#444' }}>
                  DEPTH LEVELS:
                </span>
                {Object.entries(depthColors).map(([d, item]) => (
                  <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                    <span style={{ width: '12px', height: '12px', background: item.bg, border: `1.5px solid ${item.border}`, display: 'inline-block' }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setColorScheme('outline')}
                style={{
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono',
                  border: '1px solid var(--c-black)',
                  background: 'var(--c-white)',
                  color: 'var(--c-black)',
                  cursor: 'pointer'
                }}
                title="Turn off depth overlay"
              >
                ✕ TURN OFF OVERLAY
              </button>
            </div>
          )}
        </div>

        {/* Selected CU Details Inspector Panel */}
        <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card-box" style={{
            background: 'var(--c-white)',
            border: '2px solid var(--c-black)',
            padding: '1.25rem',
            boxShadow: '3px 3px 0px rgba(0,0,0,1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--c-black)', paddingBottom: '0.5rem', marginBottom: '0.85rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', textTransform: 'uppercase', margin: 0 }}>CU Inspector</h3>
                {activeNode && (
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.25rem', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                    {activeW}×{activeH} • Cost {activeNode.cost !== null ? Number(activeNode.cost).toFixed(1) : '—'}
                  </div>
                )}
              </div>
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
                {/* CU Block Image Texture Crop */}
                <div style={{
                  padding: '0.65rem',
                  background: 'var(--c-light-gray)',
                  border: '1.5px solid var(--c-black)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569' }}>
                      Texture Crop
                    </span>
                  </div>

                  <div style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0F172A',
                    border: '1.5px solid var(--c-black)',
                    position: 'relative',
                    overflow: 'hidden',
                    padding: '0.85rem',
                    boxSizing: 'border-box'
                  }}>
                    {imageSrc ? (
                      <div
                        style={{
                          width: `${cropBoxSize}px`,
                          height: `${cropBoxSize}px`,
                          border: '2px solid #38BDF8',
                          boxShadow: 'none',
                          position: 'relative',
                          overflow: 'hidden',
                          backgroundColor: '#000',
                          transition: 'none',
                          flexShrink: 0
                        }}
                      >
                        <svg
                          viewBox={`0 0 ${activeW} ${activeH}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'block'
                          }}
                        >
                          <image
                            href={imageSrc}
                            x={-activeAbsX}
                            y={-activeAbsY}
                            width={imageDims?.width || 640}
                            height={imageDims?.height || 360}
                            preserveAspectRatio="none"
                            style={{
                              imageRendering: 'pixelated',
                              filter: textureMode === 'grayscale' ? 'grayscale(100%)' : 'none'
                            }}
                          />
                        </svg>
                      </div>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: '0.75rem', fontFamily: 'JetBrains Mono', padding: '1rem 0' }}>
                        No Image Available
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ padding: '0.65rem 0.75rem', background: 'var(--c-white)', border: '1.5px solid var(--c-black)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    Prediction Mode & Direction
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--c-blue)' }}>
                    {activeNode.mode || 'INTRA'}
                    {activeNode.mode === 'INTRA' && activeNode.intra_dir !== null && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--c-black)', fontWeight: 600 }}>
                        Mode {activeNode.intra_dir}: {getIntraModeInfo(activeNode.intra_dir).name} ({getIntraModeInfo(activeNode.intra_dir).type})
                      </span>
                    )}
                  </div>
                </div>

                {onNavigateToIntra && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeNode.width === 8) {
                        onNavigateToIntra(activeNode);
                      }
                    }}
                    disabled={activeNode.width !== 8}
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      background: activeNode.width === 8 ? 'var(--c-magenta)' : '#94A3B8',
                      color: '#FFFFFF',
                      border: '2px solid var(--c-black)',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      fontFamily: 'JetBrains Mono',
                      cursor: activeNode.width === 8 ? 'pointer' : 'not-allowed',
                      boxShadow: activeNode.width === 8 ? '3px 3px 0px rgba(0,0,0,1)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      marginTop: '0.25rem',
                      opacity: activeNode.width === 8 ? 1 : 0.7
                    }}
                    title={activeNode.width === 8 ? "Inspect 8×8 Intra Prediction Flow" : "Intra prediction pipeline chỉ hỗ trợ phân tích ma trận khối 8×8 để dễ quan sát"}
                  >
                    {activeNode.width === 8 ? 'Inspect Intra (8×8) →' : `8×8 Only (${activeW}×${activeH})`}
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                background: 'var(--c-light-gray)',
                border: '1.5px dashed #CBD5E1',
                color: '#64748B',
                fontFamily: 'JetBrains Mono',
                fontSize: '0.8rem'
              }}>
                <div style={{ fontWeight: 700, color: '#94A3B8' }}>No CU selected</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
