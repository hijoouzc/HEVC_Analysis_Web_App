import React, { useState, useRef, useMemo, useEffect } from 'react';

/**
 * FullFrameViewer - HEVC Full Frame Coding Tree & CU Partition Visualizer
 * Renders the entire frame partitioned into 64x64 CTUs and recursive leaf CUs:
 * - Full-frame partition coverage across all CTUs (0 to N-1)
 * - High-contrast grayscale video frame blending for boundary visibility
 * - Coral Red Intra / Royal Blue Inter / Green Skip mode coloring
 * - Crisp slate/dark CU partition boundaries
 * - CTU Raster Scan index numbering in top-left of each 64x64 CTU
 * - Precision '+' cross markers inside 8x8 leaf blocks
 * - Interactive CTU & CU selection with HUD diagnostics
 * - Clean technical engineering layout (strictly NO emojis)
 */
export default function FullFrameViewer({
  imageSrc,
  imageDims = { width: 640, height: 360 },
  ctuX = 0,
  ctuY = 0,
  onSelectCTU = null,
  onNavigateToQuadTree = null,
  partitionData = null,
  ctuPartitionsMap = {},
  isAnalyzed = false,
  onReAnalyze = null
}) {
  const [viewMode, setViewMode] = useState('partition'); // 'partition' (default) or 'original'
  const [colorScheme, setColorScheme] = useState('mode'); // 'mode' (default) or 'depth'
  const [frameBlend, setFrameBlend] = useState(true); // Grayscale underlying blend
  const [overlayOpacity, setOverlayOpacity] = useState(0.65); // 0.35, 0.65, 0.85, 1.0
  const [showGrid, setShowGrid] = useState(true);
  const [showCtuNumbers, setShowCtuNumbers] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showCuDimensions, setShowCuDimensions] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // 1, 2, 4
  const [focusActive, setFocusActive] = useState(false);
  const [hoveredCtu, setHoveredCtu] = useState(null);
  const [hoveredCu, setHoveredCu] = useState(null);
  const containerRef = useRef(null);

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
  const totalCtus = numCols * numRows;

  // Build grid of CTUs
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

  // Aggregate all available CTU partition trees
  const combinedPartitions = useMemo(() => {
    const map = { ...ctuPartitionsMap };
    if (partitionData && partitionData.nodes && partitionData.nodes.length > 0) {
      const pX = partitionData.ctu_x !== undefined ? partitionData.ctu_x : ctuX;
      const pY = partitionData.ctu_y !== undefined ? partitionData.ctu_y : ctuY;
      map[`${pX}_${pY}`] = { ...partitionData, ctu_x: pX, ctu_y: pY };
    }
    return map;
  }, [ctuPartitionsMap, partitionData, ctuX, ctuY]);

  const analyzedCount = Object.keys(combinedPartitions).length;

  // Calculate total leaf CUs across all partitioned CTUs
  const totalLeafCount = useMemo(() => {
    let count = 0;
    Object.values(combinedPartitions).forEach(p => {
      if (p && p.nodes) {
        count += p.nodes.filter(n => !n.split).length;
      }
    });
    return count;
  }, [combinedPartitions]);

  const handleCtuClick = (x, y) => {
    if (onSelectCTU) {
      onSelectCTU(x, y);
    }
  };

  // Color mapping matching ITU-T H.265 Prediction Modes
  const getModeFill = (mode, alpha) => {
    const m = (mode || 'INTRA').toUpperCase();
    if (m === 'INTRA') return `rgba(255, 107, 107, ${alpha})`;  // H.265 Coral Red (#FF6B6B)
    if (m === 'INTER') return `rgba(59, 130, 246, ${alpha})`;   // H.265 Royal Blue (#3B82F6)
    if (m === 'SKIP')  return `rgba(34, 197, 94, ${alpha})`;   // H.265 Skip Green (#22C55E)
    return `rgba(255, 107, 107, ${alpha})`;
  };

  const getDepthFill = (depth, alpha) => {
    const colors = {
      0: `rgba(2, 132, 199, ${alpha})`,   // Depth 0: 64x64 (Sky Blue)
      1: `rgba(14, 165, 233, ${alpha})`,  // Depth 1: 32x32 (Cyan)
      2: `rgba(249, 115, 22, ${alpha})`,  // Depth 2: 16x16 (Orange)
      3: `rgba(234, 179, 8, ${alpha})`,   // Depth 3: 8x8 (Amber/Yellow)
    };
    return colors[depth] || `rgba(100, 116, 139, ${alpha})`;
  };

  // Active CTU partition data if present
  const activePartition = combinedPartitions[`${ctuX}_${ctuY}`] || partitionData;

  // Zoom transform style
  const getCanvasTransform = () => {
    if (focusActive) {
      const centerX = ((ctuX * 64 + 32) / width) * 100;
      const centerY = ((ctuY * 64 + 32) / height) * 100;
      return {
        transformOrigin: `${centerX}% ${centerY}%`,
        transform: 'scale(3)',
        transition: 'transform 0.25s ease'
      };
    }
    if (zoomLevel > 1) {
      return {
        transformOrigin: 'top left',
        transform: `scale(${zoomLevel})`,
        transition: 'transform 0.2s ease'
      };
    }
    return {
      transform: 'none',
      transition: 'transform 0.2s ease'
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
          <div style={{
            background: viewMode === 'original' ? '#0284C7' : 'var(--c-black)',
            color: 'var(--c-white)',
            fontWeight: 800,
            fontSize: '0.78rem',
            padding: '0.3rem 0.6rem',
            letterSpacing: '0.06em',
            fontFamily: 'JetBrains Mono'
          }}>
            {viewMode === 'original' ? '[ORIGINAL SOURCE FRAME]' : '[HEVC CU PARTITION MAP]'}
          </div>
          <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em' }}>
            {viewMode === 'original' ? 'Pristine Input Frame (Unpartitioned)' : 'Full Frame QuadTree CTU/CU Partition Map'}
          </span>
          <span style={{
            fontSize: '0.75rem',
            color: '#555',
            fontFamily: 'JetBrains Mono',
            background: '#F1F5F9',
            padding: '0.2rem 0.5rem',
            border: '1px solid #CBD5E1'
          }}>
            {width} × {height} px | {numCols} × {numRows} ({totalCtus} CTUs, {analyzedCount} parsed) | {totalLeafCount} Leaf CUs
          </span>
        </div>

        {/* Action & Display Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {/* Main View Mode Toggle: Original Frame vs Partition Overlay */}
          <div style={{ display: 'flex', border: '2px solid var(--c-black)', marginRight: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setViewMode('original')}
              style={{
                padding: '0.3rem 0.75rem',
                fontSize: '0.74rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono',
                background: viewMode === 'original' ? 'var(--c-black)' : 'var(--c-white)',
                color: viewMode === 'original' ? 'var(--c-white)' : 'var(--c-black)',
                border: 'none',
                cursor: 'pointer'
              }}
              title="View clean original raw image without partitions (Shortcut: T)"
            >
              ORIGINAL
            </button>
            <button
              type="button"
              onClick={() => setViewMode('partition')}
              style={{
                padding: '0.3rem 0.75rem',
                fontSize: '0.74rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono',
                background: viewMode === 'partition' ? 'var(--c-black)' : 'var(--c-white)',
                color: viewMode === 'partition' ? 'var(--c-white)' : 'var(--c-black)',
                border: 'none',
                borderLeft: '1.5px solid var(--c-black)',
                cursor: 'pointer'
              }}
              title="View image with HEVC CU partition overlay (Shortcut: T)"
            >
              PARTITION
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
              onClick={() => setColorScheme('mode')}
              style={{
                padding: '0.3rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono',
                background: colorScheme === 'mode' ? 'var(--c-black)' : 'var(--c-white)',
                color: colorScheme === 'mode' ? 'var(--c-white)' : 'var(--c-black)',
                border: 'none',
                cursor: 'pointer'
              }}
              title="Color by HEVC Prediction Mode (Intra: Coral, Inter: Blue, Skip: Green)"
            >
              MODE
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

          {/* Grayscale Blend Toggle */}
          <button
            type="button"
            onClick={() => setFrameBlend(prev => !prev)}
            disabled={viewMode === 'original'}
            style={{
              padding: '0.3rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              border: '1.5px solid var(--c-black)',
              background: frameBlend && viewMode === 'partition' ? 'var(--c-black)' : 'var(--c-white)',
              color: frameBlend && viewMode === 'partition' ? 'var(--c-white)' : 'var(--c-black)',
              cursor: viewMode === 'original' ? 'default' : 'pointer',
              opacity: viewMode === 'original' ? 0.45 : 1
            }}
            title="Toggle video frame grayscale blend to enhance partition boundary contrast"
          >
            GRAYSCALE BLEND: {frameBlend ? 'ON' : 'OFF'}
          </button>

          {/* Fill Opacity Toggle */}
          <button
            type="button"
            onClick={() => setOverlayOpacity(prev => prev >= 0.85 ? 0.35 : prev >= 0.65 ? 0.85 : 0.65)}
            style={{
              padding: '0.3rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              border: '1.5px solid var(--c-black)',
              background: 'var(--c-white)',
              color: 'var(--c-black)',
              cursor: 'pointer'
            }}
            title="Cycle CU fill overlay opacity (35%, 65%, 85%)"
          >
            OPACITY: {Math.round(overlayOpacity * 100)}%
          </button>

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

          {/* 8x8 Cross Markers Toggle */}
          <button
            type="button"
            onClick={() => setShowMarkers(prev => !prev)}
            style={{
              padding: '0.3rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              border: '1.5px solid var(--c-black)',
              background: showMarkers ? 'var(--c-black)' : 'var(--c-white)',
              color: showMarkers ? 'var(--c-white)' : 'var(--c-black)',
              cursor: 'pointer'
            }}
            title="Toggle precision '+' cross markers on 8x8 leaf blocks"
          >
            8×8 (+): {showMarkers ? 'ON' : 'OFF'}
          </button>

          {/* CU Dimension Badges Toggle */}
          <button
            type="button"
            onClick={() => setShowCuDimensions(prev => !prev)}
            style={{
              padding: '0.3rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              border: '1.5px solid var(--c-black)',
              background: showCuDimensions ? 'var(--c-black)' : 'var(--c-white)',
              color: showCuDimensions ? 'var(--c-white)' : 'var(--c-black)',
              cursor: 'pointer'
            }}
            title="Toggle explicit block dimension text (32×32, 16×16) inside CUs"
          >
            CU SIZES: {showCuDimensions ? 'ON' : 'OFF'}
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
            FOCUS CTU [{ctuX},{ctuY}]
          </button>

          {/* View QuadTree Button */}
          {onNavigateToQuadTree && (
            <button
              type="button"
              onClick={() => onNavigateToQuadTree(ctuX, ctuY)}
              style={{
                padding: '0.3rem 0.75rem',
                fontSize: '0.72rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono',
                border: '1.5px solid var(--c-black)',
                background: 'var(--c-black)',
                color: 'var(--c-white)',
                cursor: 'pointer'
              }}
              title={`Open QuadTree partition tree for CTU (${ctuX}, ${ctuY})`}
            >
              VIEW QUADTREE ({ctuX}, {ctuY}) →
            </button>
          )}

          {/* Re-Analyze CTU Button */}
          {isAnalyzed && onReAnalyze && (
            <button
              type="button"
              onClick={() => onReAnalyze(ctuX, ctuY)}
              style={{
                padding: '0.3rem 0.75rem',
                fontSize: '0.72rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono',
                border: '1.5px solid var(--c-magenta)',
                background: 'var(--c-magenta)',
                color: 'var(--c-white)',
                cursor: 'pointer'
              }}
              title="Focus HM intra analysis on selected CTU"
            >
              ANALYZE CTU ({ctuX}, {ctuY}) →
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
          cursor: 'crosshair',
          userSelect: 'none'
        }}
      >
        <div style={{
          position: 'relative',
          width: '100%',
          ...getCanvasTransform()
        }}>
          {/* Floating Canvas Viewport Mode Pill / Quick Switch */}
          <div
            onClick={() => setViewMode(prev => prev === 'partition' ? 'original' : 'partition')}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'rgba(15, 23, 42, 0.88)',
              color: '#F8FAFC',
              border: '1.5px solid rgba(255, 255, 255, 0.25)',
              fontFamily: 'JetBrains Mono',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
              letterSpacing: '0.04em'
            }}
            title="Click to toggle between Original and Partitioned view (or press 'T')"
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: viewMode === 'original' ? '#22C55E' : '#38BDF8'
            }} />
            <span>VIEW: {viewMode === 'original' ? 'ORIGINAL SOURCE' : 'HEVC PARTITION MAP'}</span>
            <span style={{ 
              background: 'rgba(255, 255, 255, 0.15)', 
              padding: '1px 5px', 
              fontSize: '0.66rem',
              borderRadius: '2px',
              color: '#E2E8F0'
            }}>
              [T]
            </span>
          </div>

          {/* Source Image Canvas with Grayscale Frame Blend */}
          {imageSrc ? (
            <img
              src={imageSrc}
              alt="Source Frame"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                imageRendering: 'pixelated',
                filter: (viewMode === 'partition' && frameBlend) ? 'grayscale(75%) contrast(90%) brightness(0.92)' : 'none',
                transition: 'filter 0.2s ease'
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
            {/* LAYER 1: Recursive Leaf CUs across ALL CTUs */}
            {viewMode === 'partition' && Object.entries(combinedPartitions).map(([key, ctuPart]) => {
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

                    const isLeafHovered = hoveredCu && 
                      hoveredCu.x === absX && 
                      hoveredCu.y === absY && 
                      hoveredCu.width === leafW;

                    const fillColor = colorScheme === 'mode'
                      ? getModeFill(leaf.mode, overlayOpacity)
                      : getDepthFill(leaf.depth, overlayOpacity);

                    // Crisp slate boundary between CUs
                    const strokeColor = isLeafHovered ? '#FFD200' : 'rgba(71, 85, 105, 0.95)';
                    const strokeW = isLeafHovered ? 2 : 1.25;

                    return (
                      <g 
                        key={`leaf-${key}-${lIdx}`}
                        onMouseEnter={() => setHoveredCu(normalizedLeaf)}
                        onMouseLeave={() => setHoveredCu(null)}
                      >
                        {/* Leaf CU Filled Box */}
                        <rect
                          x={absX}
                          y={absY}
                          width={leafW}
                          height={leafH}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={strokeW}
                          vectorEffect="non-scaling-stroke"
                        />

                        {/* Precision '+' Cross Marker for 8x8 Leaf Blocks */}
                        {showMarkers && leafW <= 8 && (
                          <g pointerEvents="none">
                            <text
                              x={absX + leafW / 2}
                              y={absY + leafH / 2 + 2.5}
                              fill="#FFFFFF"
                              fontSize="7.5"
                              fontFamily="JetBrains Mono, monospace"
                              fontWeight="900"
                              textAnchor="middle"
                              stroke="#000000"
                              strokeWidth="1.2"
                              paintOrder="stroke"
                            >
                              +
                            </text>
                          </g>
                        )}

                        {/* Optional CU Dimension Badges */}
                        {showCuDimensions && leafW >= 16 && (
                          <g pointerEvents="none">
                            <text
                              x={absX + leafW / 2}
                              y={absY + leafH / 2 + (leafH >= 32 ? -2 : 3)}
                              fill="#FFFFFF"
                              fontSize={leafW >= 32 ? '9' : '6.5'}
                              fontFamily="JetBrains Mono, monospace"
                              fontWeight="800"
                              textAnchor="middle"
                              stroke="#000000"
                              strokeWidth="1.8"
                              paintOrder="stroke"
                            >
                              {leafW}×{leafH}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* LAYER 2: 64x64 Solid CTU Grid Boundaries & Yellow Index Numbers */}
            {ctus.map(({ index, x, y, px, py, pw, ph }) => {
              const isSelected = x === ctuX && y === ctuY;
              const isHovered = hoveredCtu && hoveredCtu.x === x && hoveredCtu.y === y;

              return (
                <g 
                  key={`ctu-grid-${x}-${y}`}
                  onClick={() => handleCtuClick(x, y)}
                  onMouseEnter={() => setHoveredCtu({ index, x, y, px, py, pw, ph })}
                  onMouseLeave={() => setHoveredCtu(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* CTU Outer Boundary Box */}
                  <rect
                    x={px}
                    y={py}
                    width={pw}
                    height={ph}
                    fill={
                      isSelected
                        ? (viewMode === 'original' ? 'rgba(0, 163, 224, 0.12)' : 'rgba(0, 163, 224, 0.22)')
                        : isHovered
                        ? (viewMode === 'original' ? 'rgba(255, 210, 0, 0.15)' : 'rgba(255, 210, 0, 0.18)')
                        : 'transparent'
                    }
                    stroke={
                      isSelected
                        ? '#00A3E0'
                        : isHovered
                        ? '#FFD200'
                        : (showGrid && viewMode === 'partition')
                        ? 'rgba(71, 85, 105, 0.8)'
                        : 'transparent'
                    }
                    strokeWidth={isSelected ? 3.5 : isHovered ? 2.5 : 2}
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* Corner Reticle Brackets for Selected Active CTU */}
                  {isSelected && (
                    <g stroke="#00A3E0" strokeWidth="2.5" fill="none">
                      <path d={`M ${px} ${py + 10} L ${px} ${py} L ${px + 10} ${py}`} />
                      <path d={`M ${px + pw - 10} ${py} L ${px + pw} ${py} L ${px + pw} ${py + 10}`} />
                      <path d={`M ${px} ${py + ph - 10} L ${px} ${py + ph} L ${px + 10} ${py + ph}`} />
                      <path d={`M ${px + pw - 10} ${py + ph} L ${px + pw} ${py + ph} L ${px + pw} ${py + ph - 10}`} />
                    </g>
                  )}

                  {/* CTU Raster Index Number (0, 1, 2, ..., N-1) in Top-Left Corner */}
                  {showCtuNumbers && viewMode === 'partition' && (
                    <g pointerEvents="none">
                      <text
                        x={px + 4}
                        y={py + 13}
                        fill={isSelected ? '#00A3E0' : '#FEF08A'}
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="900"
                        textAnchor="start"
                        stroke="#000000"
                        strokeWidth="1.8"
                        paintOrder="stroke"
                      >
                        {index}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
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
        {/* Left Side: Context & Hover Diagnostics */}
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: '#666' }}>ACTIVE CTU: </span>
            <strong style={{ color: 'var(--c-blue)', fontSize: '0.92rem' }}>
              ({ctuX}, {ctuY}) [#{ctuY * numCols + ctuX}]
            </strong>
            <span style={{ color: '#777', marginLeft: '0.4rem', fontSize: '0.72rem' }}>
              [X={ctuX * 64}..{Math.min(width, (ctuX + 1) * 64)}, Y={ctuY * 64}..{Math.min(height, (ctuY + 1) * 64)}]
            </span>
            {onNavigateToQuadTree && (
              <button
                type="button"
                onClick={() => onNavigateToQuadTree(ctuX, ctuY)}
                style={{
                  marginLeft: '0.6rem',
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  fontFamily: 'JetBrains Mono',
                  background: 'var(--c-black)',
                  color: 'var(--c-white)',
                  border: 'none',
                  cursor: 'pointer'
                }}
                title={`Open QuadTree partition tree for CTU (${ctuX}, ${ctuY})`}
              >
                VIEW QUADTREE →
              </button>
            )}
          </div>

          {activePartition && (
            <div style={{ borderLeft: '1px solid #CBD5E1', paddingLeft: '1rem' }}>
              <span style={{ color: '#666' }}>CU SPLITS: </span>
              <strong>{activePartition.leaf_nodes || activePartition.nodes?.filter(n => !n.split).length} Leaf CUs</strong>
              <span style={{ color: '#888', marginLeft: '0.4rem', fontSize: '0.72rem' }}>
                (Depth: {activePartition.max_depth ?? 0})
              </span>
            </div>
          )}

          {hoveredCu ? (
            <div style={{ borderLeft: '1px solid #CBD5E1', paddingLeft: '1rem', color: '#1E293B' }}>
              <span style={{ color: 'var(--c-magenta)', fontWeight: 700 }}>HOVERED CU: </span>
              <strong>{hoveredCu.width}×{hoveredCu.height}</strong> @ [{hoveredCu.x}, {hoveredCu.y}] | 
              <span style={{ marginLeft: '0.3rem' }}>Mode: <strong>{hoveredCu.mode || 'INTRA'}</strong></span>
              {hoveredCu.intra_dir !== null && hoveredCu.intra_dir !== undefined && (
                <span style={{ marginLeft: '0.3rem' }}>(Dir {hoveredCu.intra_dir})</span>
              )}
              {hoveredCu.cost !== null && hoveredCu.cost !== undefined && (
                <span style={{ marginLeft: '0.3rem', color: '#666' }}>Cost: {Math.round(hoveredCu.cost)}</span>
              )}
            </div>
          ) : hoveredCtu ? (
            <div style={{ borderLeft: '1px solid #CBD5E1', paddingLeft: '1rem' }}>
              <span style={{ color: '#666' }}>HOVERED: </span>
              <strong style={{ color: 'var(--c-black)' }}>CTU #{hoveredCtu.index} ({hoveredCtu.x}, {hoveredCtu.y})</strong>
              <span style={{ color: '#777', marginLeft: '0.3rem', fontSize: '0.72rem' }}>
                (Click to focus)
              </span>
            </div>
          ) : null}
        </div>

        {/* Right Side: Prediction Mode Palette Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {viewMode === 'original' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.72rem' }}>
              <span style={{ 
                background: 'var(--c-black)', 
                color: 'var(--c-white)', 
                padding: '0.2rem 0.5rem', 
                fontWeight: 800 
              }}>
                VIEW: RAW SOURCE FRAME
              </span>
              <span style={{ color: '#666' }}>
                (Press <strong>[T]</strong> or click <strong>[PARTITION]</strong> to view HEVC CU partition overlay)
              </span>
            </div>
          ) : colorScheme === 'mode' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.72rem' }}>
              <span style={{ color: '#555', fontWeight: 700 }}>PRED MODES:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '9px', height: '9px', background: '#FF6B6B', display: 'inline-block' }} />
                <span>INTRA</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '9px', height: '9px', background: '#3B82F6', display: 'inline-block' }} />
                <span>INTER</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '9px', height: '9px', background: '#22C55E', display: 'inline-block' }} />
                <span>SKIP</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#888' }}>
                <strong style={{ color: '#333' }}>+</strong>
                <span>8×8 LEAF</span>
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.72rem' }}>
              <span style={{ color: '#555', fontWeight: 700 }}>DEPTHS:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '9px', height: '9px', background: '#0284C7', display: 'inline-block' }} />
                <span>D0 (64)</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '9px', height: '9px', background: '#0EA5E9', display: 'inline-block' }} />
                <span>D1 (32)</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '9px', height: '9px', background: '#F97316', display: 'inline-block' }} />
                <span>D2 (16)</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '9px', height: '9px', background: '#EAB308', display: 'inline-block' }} />
                <span>D3 (8)</span>
              </span>
            </div>
          )}

          <div style={{ color: '#555', fontSize: '0.72rem', borderLeft: '1px solid #CBD5E1', paddingLeft: '0.75rem' }}>
            [CLICK CTU TO FOCUS / RE-ANALYZE]
          </div>
        </div>
      </div>
    </div>
  );
}
