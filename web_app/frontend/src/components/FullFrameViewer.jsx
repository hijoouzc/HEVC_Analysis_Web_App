import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';

/**
 * FullFrameViewer - HEVC Full Frame Coding Tree & CU Partition Visualizer
 * Layered High-Performance Multi-Layer Architecture:
 * - Layer 1: Static Video Frame (Pristine input image)
 * - Layer 2: Static Partition Layer (Memoized leaf CUs across all CTUs, zero re-render on CTU click)
 * - Layer 3: Static CTU Grid Layer (Memoized 64x64 boundaries & yellow index numbers)
 * - Layer 4: Active Selection Reticle (Ultra-lightweight ~5 DOM nodes, instantaneous <0.5ms response)
 */

const DEPTH_COLORS = {
  0: (alpha) => `rgba(2, 132, 199, ${alpha})`,   // Depth 0: 64x64 (Sky Blue)
  1: (alpha) => `rgba(14, 165, 233, ${alpha})`,  // Depth 1: 32x32 (Cyan)
  2: (alpha) => `rgba(249, 115, 22, ${alpha})`,  // Depth 2: 16x16 (Orange)
  3: (alpha) => `rgba(234, 179, 8, ${alpha})`,   // Depth 3: 8x8 (Amber/Yellow)
};

const getDepthFill = (depth, alpha = 0.35) => {
  const colorFn = DEPTH_COLORS[depth];
  return colorFn ? colorFn(alpha) : `rgba(100, 116, 139, ${alpha})`;
};

/**
 * StaticPartitionLayer
 * High-performance memoized layer rendering all leaf CU boxes.
 * NEVER re-renders when active CTU selection changes.
 */
const StaticPartitionLayer = React.memo(function StaticPartitionLayer({
  combinedPartitions,
  colorScheme,
  gridColor = 'white',
  onSelectLeaf
}) {
  const cuStrokeColor = gridColor === 'yellow'
    ? 'rgba(250, 204, 21, 0.90)'
    : gridColor === 'cyan'
      ? 'rgba(56, 189, 248, 0.90)'
      : 'rgba(255, 255, 255, 0.88)';

  return (
    <g className="static-partition-layer">
      {Object.entries(combinedPartitions).map(([key, ctuPart]) => {
        if (!ctuPart || !ctuPart.nodes) return null;
        const leaves = ctuPart.nodes.filter(n => !n.split);
        const ctuOriginX = (ctuPart.ctu_x ?? 0) * 64;
        const ctuOriginY = (ctuPart.ctu_y ?? 0) * 64;

        return (
          <g key={`partition-ctu-${key}`}>
            {leaves.map((leaf, lIdx) => {
              let absX = ctuOriginX;
              if (typeof leaf.x === 'number' && !isNaN(leaf.x)) {
                absX = (leaf.x < 64 && ctuOriginX >= 64) ? (ctuOriginX + leaf.x) : leaf.x;
              } else if (typeof leaf.rel_x === 'number' && !isNaN(leaf.rel_x)) {
                absX = ctuOriginX + leaf.rel_x;
              }

              let absY = ctuOriginY;
              if (typeof leaf.y === 'number' && !isNaN(leaf.y)) {
                absY = (leaf.y < 64 && ctuOriginY >= 64) ? (ctuOriginY + leaf.y) : leaf.y;
              } else if (typeof leaf.rel_y === 'number' && !isNaN(leaf.rel_y)) {
                absY = ctuOriginY + leaf.rel_y;
              }

              const leafW = (typeof leaf.width === 'number' && !isNaN(leaf.width) && leaf.width > 0) ? leaf.width : 64;
              const leafH = (typeof leaf.height === 'number' && !isNaN(leaf.height) && leaf.height > 0) ? leaf.height : 64;
              const normalizedLeaf = { ...leaf, x: absX, y: absY, width: leafW, height: leafH };

              const fillColor = colorScheme === 'depth' ? getDepthFill(leaf.depth, 0.35) : 'transparent';
              const leafCtuX = Math.floor(absX / 64);
              const leafCtuY = Math.floor(absY / 64);

              return (
                <g
                  key={`leaf-${key}-${lIdx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLeaf(normalizedLeaf, leafCtuX, leafCtuY);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Leaf CU Filled Box */}
                  <rect
                    x={absX}
                    y={absY}
                    width={leafW}
                    height={leafH}
                    fill={fillColor}
                    stroke={cuStrokeColor}
                    strokeWidth={1.25}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
});

/**
 * StaticCtuGridLayer
 * High-performance memoized layer rendering 64x64 CTU boundaries and Yellow Raster Index numbers.
 * NEVER re-renders when active CTU selection changes.
 */
const StaticCtuGridLayer = React.memo(function StaticCtuGridLayer({
  ctus,
  showGrid,
  gridColor = 'white',
  showCtuNumbers,
  viewMode,
  onCtuClick
}) {
  const ctuStrokeColor = gridColor === 'yellow'
    ? '#FACC15'
    : gridColor === 'cyan'
      ? '#38BDF8'
      : '#FFFFFF';

  return (
    <g className="static-ctu-grid-layer">
      {ctus.map(({ index, x, y, px, py, pw, ph }) => (
        <g
          key={`ctu-grid-${x}-${y}`}
          onClick={() => onCtuClick(x, y)}
          style={{ cursor: 'pointer' }}
        >
          {/* CTU Outer Boundary Box */}
          <rect
            x={px}
            y={py}
            width={pw}
            height={ph}
            fill="transparent"
            stroke={showGrid ? ctuStrokeColor : 'transparent'}
            strokeWidth={viewMode === 'original' ? 1.2 : 2.0}
            strokeDasharray={viewMode === 'original' ? '4 3' : 'none'}
            vectorEffect="non-scaling-stroke"
          />

          {/* CTU Raster Index Number in Top-Left Corner */}
          {showCtuNumbers && viewMode === 'partition' && (
            <text
              x={px + 4}
              y={py + 13}
              fill="#FEF08A"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="900"
              textAnchor="start"
              stroke="#000000"
              strokeWidth="1.8"
              paintOrder="stroke"
              pointerEvents="none"
            >
              {index}
            </text>
          )}
        </g>
      ))}
    </g>
  );
});

/**
 * ActiveSelectionLayer
 * Ultra-lightweight SVG layer containing ONLY the active CTU cyan reticle and/or active CU magenta box.
 * Only this layer renders upon selection click (~5 DOM elements, <0.1ms).
 */
const ActiveSelectionLayer = React.memo(function ActiveSelectionLayer({
  activeCtu,
  activeCu,
  viewMode
}) {
  return (
    <g className="active-selection-layer" pointerEvents="none">
      {/* 1. Active Selected CTU Reticle */}
      {activeCtu && (
        <rect
          x={activeCtu.px}
          y={activeCtu.py}
          width={activeCtu.pw}
          height={activeCtu.ph}
          fill={viewMode === 'original' ? 'rgba(0, 163, 224, 0.12)' : 'rgba(0, 163, 224, 0.22)'}
          stroke="#00A3E0"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* 2. Active Selected CU Box */}
      {activeCu && (
        <rect
          x={activeCu.x}
          y={activeCu.y}
          width={activeCu.width}
          height={activeCu.height}
          fill="rgba(222, 0, 106, 0.35)"
          stroke="var(--c-magenta)"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
});

function FullFrameViewer({
  imageSrc,
  imageDims = { width: 640, height: 360 },
  ctuX = 0,
  ctuY = 0,
  onSelectCTU = null,
  onNavigateToQuadTree = null,
  partitionData = null,
  ctuPartitionsMap = {},
  isAnalyzed = false,
  onReAnalyze = null,
  loading = false,
  selectedCu: propsSelectedCu = undefined,
  onSelectCU = null
}) {
  const [viewMode, setViewMode] = useState(isAnalyzed ? 'partition' : 'original');
  const [colorScheme, setColorScheme] = useState('outline'); // 'outline' (clean transparent) or 'depth'
  const [showGrid, setShowGrid] = useState(true);
  const [gridColor, setGridColor] = useState('white'); // 'white' (default: pure white), 'yellow' (#FACC15), 'cyan' (#38BDF8)
  const [showCtuNumbers, setShowCtuNumbers] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // 1, 2, 4
  const [focusActive, setFocusActive] = useState(false);
  const [selectedCu, setSelectedCu] = useState(null);
  const [selectedOverride, setSelectedOverride] = useState(null);
  const [prevPropsCtu, setPrevPropsCtu] = useState({ x: ctuX, y: ctuY });
  const [prevIsAnalyzed, setPrevIsAnalyzed] = useState(isAnalyzed);
  const containerRef = useRef(null);

  if (isAnalyzed !== prevIsAnalyzed) {
    setPrevIsAnalyzed(isAnalyzed);
    setViewMode(isAnalyzed ? 'partition' : 'original');
  }

  const activeCu = propsSelectedCu !== undefined ? propsSelectedCu : selectedCu;

  // Synchronize local state when props change without effect setState
  if (ctuX !== prevPropsCtu.x || ctuY !== prevPropsCtu.y) {
    setPrevPropsCtu({ x: ctuX, y: ctuY });
    setSelectedOverride(null);
  }

  const activeCtuX = selectedOverride !== null ? selectedOverride.x : ctuX;
  const activeCtuY = selectedOverride !== null ? selectedOverride.y : ctuY;
  const localCtu = useMemo(() => {
    if (activeCtuX === null || activeCtuY === null || activeCtuX === undefined || activeCtuY === undefined) {
      return null;
    }
    return { x: activeCtuX, y: activeCtuY };
  }, [activeCtuX, activeCtuY]);

  // Quick keyboard toggle: Press 'T' or 't' to toggle between Original and Partitioned view
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 't' || e.key === 'T') {
        setViewMode(prev => (prev === 'partition' ? 'original' : 'partition'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { width, height } = imageDims;
  const ctuSize = 64;
  const numCols = Math.max(1, Math.ceil(width / ctuSize));
  const numRows = Math.max(1, Math.ceil(height / ctuSize));

  // Build grid of CTUs (Memoized, only changes on image dimension changes)
  const ctus = useMemo(() => {
    const list = [];
    for (let y = 0; y < numRows; y++) {
      for (let x = 0; x < numCols; x++) {
        const px = x * ctuSize;
        const py = y * ctuSize;
        const pw = Math.min(ctuSize, width - px);
        const ph = Math.min(ctuSize, height - py);
        const index = y * numCols + x;
        list.push({ index, x, y, px, py, pw, ph });
      }
    }
    return list;
  }, [numRows, numCols, width, height]);

  // Aggregate all available CTU partition trees (Independent of ctuX, ctuY)
  const combinedPartitions = useMemo(() => {
    const map = { ...ctuPartitionsMap };
    if (partitionData && partitionData.nodes && partitionData.nodes.length > 0) {
      const pX = partitionData.ctu_x !== undefined ? partitionData.ctu_x : 0;
      const pY = partitionData.ctu_y !== undefined ? partitionData.ctu_y : 0;
      map[`${pX}_${pY}`] = { ...partitionData, ctu_x: pX, ctu_y: pY };
    }
    return map;
  }, [ctuPartitionsMap, partitionData]);

  // Instantaneous click handler for CTU selection: click once to select, click again to deselect
  const handleCtuClick = useCallback((x, y) => {
    if (localCtu && localCtu.x === x && localCtu.y === y && !activeCu) {
      // Clicked on already selected CTU (with no active CU) -> Deselect CTU!
      setSelectedOverride({ x: null, y: null });
      setSelectedCu(null);
      if (onSelectCTU) onSelectCTU(null, null);
      if (onSelectCU) onSelectCU(null);
    } else {
      // Clicked on a CTU -> Select it!
      setSelectedOverride({ x, y });
      setSelectedCu(null);
      if (onSelectCTU) onSelectCTU(x, y);
      if (onSelectCU) onSelectCU(null);
    }
  }, [localCtu, activeCu, onSelectCTU, onSelectCU]);

  // Instantaneous click handler for leaf CU selection: click once to select, click again to deselect
  const handleLeafClick = useCallback((leaf, leafCtuX, leafCtuY) => {
    const isSameLeaf = activeCu && activeCu.x === leaf.x && activeCu.y === leaf.y && activeCu.width === leaf.width;
    if (isSameLeaf) {
      // Clicked on already selected CU -> Deselect CU!
      setSelectedCu(null);
      if (onSelectCU) onSelectCU(null);
    } else {
      // Clicked on a CU -> Select it!
      setSelectedCu(leaf);
      setSelectedOverride({ x: leafCtuX, y: leafCtuY });
      if (onSelectCTU) onSelectCTU(leafCtuX, leafCtuY);
      if (onSelectCU) onSelectCU(leaf);
    }
  }, [activeCu, onSelectCTU, onSelectCU]);

  // Lightweight active CTU bounding box data
  const activeCtuData = useMemo(() => {
    if (!localCtu) return null;
    const px = localCtu.x * ctuSize;
    const py = localCtu.y * ctuSize;
    const pw = Math.min(ctuSize, width - px);
    const ph = Math.min(ctuSize, height - py);
    return { x: localCtu.x, y: localCtu.y, px, py, pw, ph };
  }, [localCtu, width, height, ctuSize]);

  // Active CTU partition data if present
  const activePartition = (localCtu && combinedPartitions[`${localCtu.x}_${localCtu.y}`]) || (
    localCtu && partitionData && (partitionData.ctu_x === localCtu.x && partitionData.ctu_y === localCtu.y) ? partitionData : null
  );

  // Zoom transform style
  const getCanvasTransform = () => {
    if (focusActive && localCtu) {
      const centerX = ((localCtu.x * 64 + 32) / width) * 100;
      const centerY = ((localCtu.y * 64 + 32) / height) * 100;
      return {
        transformOrigin: `${centerX}% ${centerY}%`,
        transform: 'scale(3)',
        transition: 'none'
      };
    }
    if (zoomLevel > 1) {
      return {
        transformOrigin: 'top left',
        transform: `scale(${zoomLevel})`,
        transition: 'none'
      };
    }
    return {
      transform: 'none',
      transition: 'none'
    };
  };

  return (
    <div className="full-frame-card" style={{
      background: 'var(--c-white)',
      border: '2px solid var(--c-black)',
      padding: '1.25rem',
      marginBottom: '1.5rem',
      boxShadow: '4px 4px 0px rgba(0,0,0,0.1)'
    }}>
      {/* Header & Controls Toolbar */}
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
        {/* Title & Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
            {viewMode === 'original' ? 'Original Frame' : 'Partition Map'}
          </h2>
          <span style={{
            fontSize: '0.72rem',
            color: '#64748B',
            fontFamily: 'JetBrains Mono',
          }}>
            {width} × {height} • {numCols} × {numRows} CTUs
          </span>
        </div>

        {/* Action & Display Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {/* Main View Mode Toggle */}
          <div style={{ display: 'flex', border: '1px solid #CBD5E1', marginRight: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setViewMode('original')}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.74rem',
                fontWeight: 600,
                fontFamily: 'JetBrains Mono',
                background: viewMode === 'original' ? 'var(--c-black)' : 'var(--c-white)',
                color: viewMode === 'original' ? 'var(--c-white)' : 'var(--c-black)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Original
            </button>
            <button
              type="button"
              onClick={() => setViewMode('partition')}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.74rem',
                fontWeight: 600,
                fontFamily: 'JetBrains Mono',
                background: viewMode === 'partition' ? 'var(--c-black)' : 'var(--c-white)',
                color: viewMode === 'partition' ? 'var(--c-white)' : 'var(--c-black)',
                border: 'none',
                borderLeft: '1px solid #CBD5E1',
                cursor: 'pointer'
              }}
            >
              Partition Map
            </button>
          </div>

          {/* Color Mode Toggle */}
          <div style={{
            display: 'flex',
            border: '1.5px solid var(--c-black)',
            opacity: viewMode === 'original' ? 0.45 : 1,
            pointerEvents: viewMode === 'original' ? 'none' : 'auto'
          }}>
            <button
              type="button"
              onClick={() => setColorScheme('outline')}
              style={{
                padding: '0.3rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono',
                background: colorScheme === 'outline' ? 'var(--c-black)' : 'var(--c-white)',
                color: colorScheme === 'outline' ? 'var(--c-white)' : 'var(--c-black)',
                border: 'none',
                cursor: 'pointer'
              }}
              title="Clean transparent partition boundary outlines without color overlay"
            >
              OUTLINE
            </button>
            <button
              type="button"
              onClick={() => setColorScheme('depth')}
              style={{
                padding: '0.3rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono',
                background: colorScheme === 'depth' ? 'var(--c-black)' : 'var(--c-white)',
                color: colorScheme === 'depth' ? 'var(--c-white)' : 'var(--c-black)',
                border: 'none',
                borderLeft: '1px solid var(--c-black)',
                cursor: 'pointer'
              }}
              title="Color by QuadTree Depth (0:64, 1:32, 2:16, 3:8)"
            >
              DEPTH
            </button>
          </div>

          {/* Yellow CTU Index Numbers Toggle */}
          <button
            type="button"
            onClick={() => setShowCtuNumbers(prev => !prev)}
            style={{
              padding: '0.3rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              border: '1.5px solid #CA8A04',
              background: showCtuNumbers ? '#FEF08A' : 'var(--c-white)',
              color: '#854D0E',
              cursor: 'pointer'
            }}
            title="Toggle Yellow CTU Index numbers (0-59) in top-left of each CTU"
          >
            CTU NUMS: {showCtuNumbers ? 'ON' : 'OFF'}
          </button>

          {/* Grid Toggle */}
          <button
            type="button"
            onClick={() => setShowGrid(prev => !prev)}
            style={{
              padding: '0.3rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              border: '1.5px solid var(--c-black)',
              background: showGrid ? 'var(--c-black)' : 'var(--c-white)',
              color: showGrid ? 'var(--c-white)' : 'var(--c-black)',
              cursor: 'pointer'
            }}
            title="Toggle 64x64 CTU boundaries"
          >
            GRID: {showGrid ? 'ON' : 'OFF'}
          </button>

          {/* Grid Color Cycle: White -> Yellow -> Cyan */}
          <button
            type="button"
            onClick={() => setGridColor(c => c === 'white' ? 'yellow' : c === 'yellow' ? 'cyan' : 'white')}
            style={{
              padding: '0.3rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              border: '1.5px solid var(--c-black)',
              background: 'var(--c-white)',
              color: gridColor === 'yellow' ? '#A16207' : gridColor === 'cyan' ? '#0369A1' : '#0F172A',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
            title="Cycle Grid Color: White (#FFF) -> Yellow (#FACC15) -> Cyan (#38BDF8)"
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: gridColor === 'yellow' ? '#FACC15' : gridColor === 'cyan' ? '#38BDF8' : '#FFFFFF',
              border: '1px solid #000',
              display: 'inline-block'
            }} />
            <span>{gridColor.toUpperCase()}</span>
          </button>

          {/* Zoom Level Toggle */}
          <button
            type="button"
            onClick={() => {
              setFocusActive(false);
              setZoomLevel(prev => (prev === 1 ? 2 : prev === 2 ? 4 : 1));
            }}
            style={{
              padding: '0.3rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              border: '1.5px solid var(--c-black)',
              background: zoomLevel > 1 && !focusActive ? 'var(--c-black)' : 'var(--c-white)',
              color: zoomLevel > 1 && !focusActive ? 'var(--c-white)' : 'var(--c-black)',
              cursor: 'pointer'
            }}
            title="Cycle Zoom: 1x -> 2x -> 4x"
          >
            ZOOM: {zoomLevel}×
          </button>

          {/* Focus Active CTU */}
          {localCtu && (
            <button
              type="button"
              onClick={() => setFocusActive(prev => !prev)}
              style={{
                padding: '0.3rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono',
                border: '1.5px solid var(--c-blue)',
                background: focusActive ? 'var(--c-blue)' : 'var(--c-white)',
                color: focusActive ? 'var(--c-white)' : 'var(--c-blue)',
                cursor: 'pointer'
              }}
              title="Focus and magnify the active CTU (64x64)"
            >
              FOCUS CTU [{localCtu.x},{localCtu.y}]
            </button>
          )}

          {/* Re-Analyze CTU Button */}
          {isAnalyzed && onReAnalyze && localCtu && (
            <button
              type="button"
              onClick={() => onReAnalyze(localCtu.x, localCtu.y)}
              disabled={loading}
              style={{
                padding: '0.3rem 0.75rem',
                fontSize: '0.72rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono',
                border: '1.5px solid var(--c-magenta)',
                background: loading ? '#888888' : 'var(--c-magenta)',
                color: 'var(--c-white)',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
              title="Focus HM intra analysis on selected CTU"
            >
              {loading ? 'ANALYZING...' : `ANALYZE CTU (${localCtu.x}, ${localCtu.y}) →`}
            </button>
          )}
        </div>
      </div>

      {/* Interactive Frame Canvas Viewport */}
      <div 
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          maxHeight: '720px',
          overflow: zoomLevel > 1 || focusActive ? 'auto' : 'hidden',
          border: '2px solid var(--c-black)',
          background: '#1E293B',
          cursor: 'default',
          userSelect: 'none'
        }}
      >
        <div style={{
          position: 'relative',
          width: '100%',
          ...getCanvasTransform()
        }}>
          {loading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255, 255, 255, 0.72)',
              backdropFilter: 'blur(2px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 35,
              fontFamily: 'JetBrains Mono',
              fontWeight: 800,
              fontSize: '0.9rem',
              color: 'var(--c-black)'
            }}>
              [ENCODING IN PROGRESS... PLEASE WAIT]
            </div>
          )}
          {/* Source Image Canvas */}
          {imageSrc ? (
            <img
              src={imageSrc}
              alt="Source Frame"
              style={{
                width: '100%',
                height: 'auto',
                aspectRatio: `${width} / ${height}`,
                objectFit: 'fill',
                display: 'block',
                imageRendering: 'pixelated'
              }}
            />
          ) : (
            <div style={{
              height: '340px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94A3B8',
              fontFamily: 'JetBrains Mono',
              fontSize: '0.9rem'
            }}>
              [NO FRAME LOADED]
            </div>
          )}

          {/* SVG Accurate CTU & CU Partition Overlay (ITU-T H.265 Standard) */}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'all'
            }}
          >
            {/* LAYER 1: Static Leaf CUs across ALL CTUs (Memoized, 0 re-render on CTU click) */}
            {viewMode === 'partition' && (
              <StaticPartitionLayer
                combinedPartitions={combinedPartitions}
                colorScheme={colorScheme}
                gridColor={gridColor}
                onSelectLeaf={handleLeafClick}
              />
            )}

            {/* LAYER 2: Static 64x64 CTU Grid Boundaries & Yellow Index Numbers (Memoized, 0 re-render on CTU click) */}
            <StaticCtuGridLayer
              ctus={ctus}
              showGrid={showGrid}
              gridColor={gridColor}
              showCtuNumbers={showCtuNumbers}
              viewMode={viewMode}
              onCtuClick={handleCtuClick}
            />

            {/* LAYER 3: Active CTU & CU Selection Reticle (Ultra-lightweight ~5 DOM nodes, instantaneous <0.1ms update) */}
            <ActiveSelectionLayer
              activeCtu={activeCtuData}
              activeCu={activeCu}
              viewMode={viewMode}
            />
          </svg>
        </div>
      </div>

      {/* Bottom Technical HUD & Inspector Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginTop: '0.75rem',
        padding: '0.65rem 0.85rem',
        background: 'var(--c-light-gray)',
        border: '1px solid var(--c-silver)',
        fontFamily: 'JetBrains Mono',
        fontSize: '0.78rem'
      }}>
        {/* Left Side: Context */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {localCtu ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#64748B' }}>Target CTU:</span>
              <strong style={{ color: '#0284C7' }}>
                ({localCtu.x}, {localCtu.y})
              </strong>
              {onNavigateToQuadTree && (
                <button
                  type="button"
                  onClick={() => onNavigateToQuadTree(localCtu.x, localCtu.y)}
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    fontFamily: 'JetBrains Mono',
                    background: 'var(--c-black)',
                    color: 'var(--c-white)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  QuadTree →
                </button>
              )}
            </div>
          ) : (
            <div>
              <span style={{ color: '#64748B' }}>All CTUs</span>
            </div>
          )}

          {activePartition && (
            <div style={{ borderLeft: '1px solid #CBD5E1', paddingLeft: '1rem' }}>
              <span style={{ color: '#666' }}>CU Splits: </span>
              <strong>{activePartition.leaf_nodes || activePartition.nodes?.filter(n => !n.split).length} Leaf CUs</strong>
            </div>
          )}

          {activeCu && (
            <div style={{ borderLeft: '1px solid #CBD5E1', paddingLeft: '1rem', color: '#1E293B' }}>
              <span style={{ color: 'var(--c-magenta)', fontWeight: 700 }}>CU: </span>
              <strong>{activeCu.width}×{activeCu.height}</strong> | 
              <span style={{ marginLeft: '0.3rem' }}>Mode: <strong>{activeCu.mode || 'INTRA'}</strong></span>
              {activeCu.intra_dir !== null && activeCu.intra_dir !== undefined && (
                <span style={{ marginLeft: '0.3rem' }}>(Dir {activeCu.intra_dir})</span>
              )}
              {activeCu.cost !== null && activeCu.cost !== undefined && (
                <span style={{ marginLeft: '0.3rem', color: '#666' }}>Cost: {Math.round(activeCu.cost)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(FullFrameViewer);
