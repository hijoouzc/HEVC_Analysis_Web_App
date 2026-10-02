import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Fast Turbo Colormap for false-color heatmap visualization
 */
function turboColormap(t) {
  const x = Math.max(0, Math.min(1, t));
  const r = Math.round(
    255 *
    Math.max(
      0,
      Math.min(
        1,
        0.1357 +
        x * (4.5974 - x * (42.3277 - x * (130.5887 - x * (150.5667 - x * 58.1375))))
      )
    )
  );
  const g = Math.round(
    255 *
    Math.max(
      0,
      Math.min(
        1,
        0.0914 +
        x * (2.1856 + x * (4.8052 - x * (14.0195 - x * (4.2109 + x * 2.7747))))
      )
    )
  );
  const b = Math.round(
    255 *
    Math.max(
      0,
      Math.min(
        1,
        0.1067 +
        x * (12.5845 - x * (51.6586 - x * (98.6755 - x * (88.4236 - x * 31.3065))))
      )
    )
  );
  return [r, g, b];
}

/**
 * CanvasCard: Clean viewport panel for an individual color plane
 */
const CanvasCard = ({
  title,
  badge,
  canvasRef,
  imgWidth,
  imgHeight,
  onClick,
  overlay,
}) => (
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
        padding: '0.4rem 0.75rem',
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
          padding: '0.1rem 0.4rem',
          fontSize: '0.68rem',
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
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          imageRendering: 'pixelated',
        }}
      />
      {overlay}
    </div>
  </div>
);

/**
 * YUVViewer Component
 * Minimalist color space decomposition viewer (Y, U, V)
 * Clean Apple-inspired design without hover mouse artifacts.
 */
const YUVViewer = ({
  imageSrc,
  imageDims,
  ctuX,
  ctuY,
  onSelectCTU,
  onNavigateToQuadTree,
  onNavigateToIntra,
}) => {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'composite' | 'y' | 'u' | 'v'
  const [colorMode, setColorMode] = useState('tint'); // 'tint' | 'monochrome' | 'heatmap'
  const [showCtuGrid, setShowCtuGrid] = useState(true);
  const [selectedPixel, setSelectedPixel] = useState(null);

  // Active inspected pixel is valid only when a CTU is actively selected
  const activePixel = (ctuX !== null && ctuY !== null) ? selectedPixel : null;

  const compositeCanvasRef = useRef(null);
  const yCanvasRef = useRef(null);
  const uCanvasRef = useRef(null);
  const vCanvasRef = useRef(null);
  const pixelBufferRef = useRef(null);

  const imgWidth = imageDims?.width || 640;
  const imgHeight = imageDims?.height || 360;

  // Process raw image into Y, U, V buffers and render to canvases
  useEffect(() => {
    if (!imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = imgWidth;
      const h = imgHeight;

      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      pixelBufferRef.current = { data, w, h };

      const yData = new Uint8ClampedArray(w * h * 4);
      const uData = new Uint8ClampedArray(w * h * 4);
      const vData = new Uint8ClampedArray(w * h * 4);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const yVal = Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
        const uVal = Math.max(0, Math.min(255, Math.round(128 - 0.168736 * r - 0.331264 * g + 0.5 * b)));
        const vVal = Math.max(0, Math.min(255, Math.round(128 + 0.5 * r - 0.418688 * g - 0.081312 * b)));

        if (colorMode === 'heatmap') {
          const [hr, hg, hb] = turboColormap(yVal / 255);
          yData[i] = hr; yData[i + 1] = hg; yData[i + 2] = hb; yData[i + 3] = 255;
        } else {
          yData[i] = yVal; yData[i + 1] = yVal; yData[i + 2] = yVal; yData[i + 3] = 255;
        }

        if (colorMode === 'heatmap') {
          const [hr, hg, hb] = turboColormap(uVal / 255);
          uData[i] = hr; uData[i + 1] = hg; uData[i + 2] = hb; uData[i + 3] = 255;
        } else if (colorMode === 'tint') {
          const tr = 128;
          const tg = Math.max(0, Math.min(255, Math.round(128 - 0.344136 * (uVal - 128))));
          const tb = Math.max(0, Math.min(255, Math.round(128 + 1.772 * (uVal - 128))));
          uData[i] = tr; uData[i + 1] = tg; uData[i + 2] = tb; uData[i + 3] = 255;
        } else {
          uData[i] = uVal; uData[i + 1] = uVal; uData[i + 2] = uVal; uData[i + 3] = 255;
        }

        if (colorMode === 'heatmap') {
          const [hr, hg, hb] = turboColormap(vVal / 255);
          vData[i] = hr; vData[i + 1] = hg; vData[i + 2] = hb; vData[i + 3] = 255;
        } else if (colorMode === 'tint') {
          const tr = Math.max(0, Math.min(255, Math.round(128 + 1.402 * (vVal - 128))));
          const tg = Math.max(0, Math.min(255, Math.round(128 - 0.714136 * (vVal - 128))));
          const tb = 128;
          vData[i] = tr; vData[i + 1] = tg; vData[i + 2] = tb; vData[i + 3] = 255;
        } else {
          vData[i] = vVal; vData[i + 1] = vVal; vData[i + 2] = vVal; vData[i + 3] = 255;
        }
      }

      const drawCanvas = (canvasRef, pixelArray) => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = w;
        canvas.height = h;
        const cCtx = canvas.getContext('2d');
        const idata = cCtx.createImageData(w, h);
        idata.data.set(pixelArray);
        cCtx.putImageData(idata, 0, 0);
      };

      if (compositeCanvasRef.current) {
        const cCanvas = compositeCanvasRef.current;
        cCanvas.width = w;
        cCanvas.height = h;
        const cCtx = cCanvas.getContext('2d');
        cCtx.drawImage(img, 0, 0, w, h);
      }

      drawCanvas(yCanvasRef, yData);
      drawCanvas(uCanvasRef, uData);
      drawCanvas(vCanvasRef, vData);
    };
    img.src = imageSrc;
  }, [imageSrc, imgWidth, imgHeight, colorMode]);

  // Click on canvas selects CTU and sets deliberate pixel inspection; clicking selected CTU deselects it
  const handleClick = useCallback((e) => {
    if (!pixelBufferRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = imgWidth / rect.width;
    const scaleY = imgHeight / rect.height;

    const x = Math.min(imgWidth - 1, Math.max(0, Math.floor((e.clientX - rect.left) * scaleX)));
    const y = Math.min(imgHeight - 1, Math.max(0, Math.floor((e.clientY - rect.top) * scaleY)));

    const idx = (y * imgWidth + x) * 4;
    const data = pixelBufferRef.current.data;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    const yVal = Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
    const uVal = Math.max(0, Math.min(255, Math.round(128 - 0.168736 * r - 0.331264 * g + 0.5 * b)));
    const vVal = Math.max(0, Math.min(255, Math.round(128 + 0.5 * r - 0.418688 * g - 0.081312 * b)));

    const targetCtuX = Math.floor(x / 64);
    const targetCtuY = Math.floor(y / 64);

    // Toggle off / deselect CTU if user clicks the currently selected CTU
    if (ctuX === targetCtuX && ctuY === targetCtuY) {
      setSelectedPixel(null);
      if (onSelectCTU) {
        onSelectCTU(null, null);
      }
      return;
    }

    setSelectedPixel({
      x,
      y,
      r,
      g,
      b,
      yVal,
      uVal,
      vVal,
      ctuX: targetCtuX,
      ctuY: targetCtuY,
    });

    if (onSelectCTU) {
      onSelectCTU(targetCtuX, targetCtuY);
    }
  }, [imgWidth, imgHeight, ctuX, ctuY, onSelectCTU]);

  // Clean overlay SVG showing CTU grid without mouse-glide lines
  const renderOverlay = () => {
    const numCtuX = Math.ceil(imgWidth / 64);
    const numCtuY = Math.ceil(imgHeight / 64);

    return (
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
        viewBox={`0 0 ${imgWidth} ${imgHeight}`}
        preserveAspectRatio="none"
      >
        {showCtuGrid && (
          <g stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.75" strokeDasharray="3 3">
            {Array.from({ length: numCtuX + 1 }).map((_, i) => (
              <line key={`vx-${i}`} x1={i * 64} y1={0} x2={i * 64} y2={imgHeight} />
            ))}
            {Array.from({ length: numCtuY + 1 }).map((_, i) => (
              <line key={`hy-${i}`} x1={0} y1={i * 64} x2={imgWidth} y2={i * 64} />
            ))}
          </g>
        )}

        {ctuX !== null && ctuY !== null && (
          <rect
            x={ctuX * 64}
            y={ctuY * 64}
            width={64}
            height={64}
            fill="rgba(2, 132, 199, 0.2)"
            stroke="#0284C7"
            strokeWidth="1.5"
          />
        )}
      </svg>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Clean Apple-style Toolbar */}
      <div
        className="stage-section-card"
        style={{ padding: '0.75rem 1rem', background: '#FAFAFA' }}
      >
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
              YUV Color Planes
            </h2>
          </div>

          {ctuX !== null && ctuY !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                Target: CTU ({ctuX}, {ctuY})
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedPixel(null);
                  if (onSelectCTU) onSelectCTU(null, null);
                }}
                style={{
                  padding: '0.25rem 0.55rem',
                  background: 'var(--c-white)',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#64748B',
                }}
                title="Deselect CTU"
              >
                ✕ Deselect
              </button>
              {onNavigateToQuadTree && (
                <button
                  type="button"
                  onClick={() => onNavigateToQuadTree(ctuX, ctuY)}
                  style={{
                    padding: '0.25rem 0.55rem',
                    background: 'var(--c-white)',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  QuadTree →
                </button>
              )}
              {onNavigateToIntra && (
                <button
                  type="button"
                  onClick={() => onNavigateToIntra(ctuX, ctuY)}
                  style={{
                    padding: '0.25rem 0.55rem',
                    background: 'var(--c-black)',
                    color: 'var(--c-white)',
                    border: '1px solid var(--c-black)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Intra →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Segmented Controls */}
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
          {/* Layout Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>
              View:
            </span>
            {[
              { id: 'grid', label: 'Grid' },
              { id: 'composite', label: 'Composite' },
              { id: 'y', label: 'Y (Luma)' },
              { id: 'u', label: 'U (Cb)' },
              { id: 'v', label: 'V (Cr)' },
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setViewMode(m.id)}
                style={{
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: '1px solid #CBD5E1',
                  background: viewMode === m.id ? 'var(--c-black)' : 'var(--c-white)',
                  color: viewMode === m.id ? 'var(--c-white)' : 'var(--c-black)',
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Color Mode Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>
              Color:
            </span>
            {[
              { id: 'tint', label: 'Color Tint' },
              { id: 'monochrome', label: 'Grayscale' },
              { id: 'heatmap', label: 'Heatmap' },
            ].map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColorMode(c.id)}
                style={{
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: '1px solid #CBD5E1',
                  background: colorMode === c.id ? '#0284C7' : 'var(--c-white)',
                  color: colorMode === c.id ? '#FFFFFF' : 'var(--c-black)',
                  cursor: 'pointer',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Grid Toggle */}
          <button
            type="button"
            onClick={() => setShowCtuGrid(prev => !prev)}
            style={{
              padding: '0.2rem 0.5rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              border: '1px solid #CBD5E1',
              background: showCtuGrid ? '#FEF08A' : 'var(--c-white)',
              color: 'var(--c-black)',
              cursor: 'pointer',
            }}
          >
            CTU Grid: {showCtuGrid ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* Selected Pixel Inspector (Only updates deliberately on click) */}
      {activePixel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.45rem 0.85rem',
            background: '#F1F5F9',
            border: '1px solid #CBD5E1',
            fontSize: '0.75rem',
            fontFamily: 'JetBrains Mono',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>
              Pixel ({activePixel.x}, {activePixel.y}) • CTU ({activePixel.ctuX}, {activePixel.ctuY})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  background: `rgb(${activePixel.r}, ${activePixel.g}, ${activePixel.b})`,
                  border: '1px solid #64748B',
                  display: 'inline-block',
                }}
              />
              <span>RGB({activePixel.r}, {activePixel.g}, {activePixel.b})</span>
            </div>
            <span>Y: {activePixel.yVal}</span>
            <span>U: {activePixel.uVal}</span>
            <span>V: {activePixel.vVal}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedPixel(null);
              if (onSelectCTU) onSelectCTU(null, null);
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: '0.7rem' }}
            title="Deselect CTU"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Viewport Panels */}
      {viewMode === 'grid' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.85rem',
          }}
        >
          <CanvasCard
            title="Composite"
            badge="RGB"
            canvasRef={compositeCanvasRef}
            imgWidth={imgWidth}
            imgHeight={imgHeight}
            onClick={handleClick}
            overlay={renderOverlay()}
          />
          <CanvasCard
            title="Luma"
            badge="Y"
            canvasRef={yCanvasRef}
            imgWidth={imgWidth}
            imgHeight={imgHeight}
            onClick={handleClick}
            overlay={renderOverlay()}
          />
          <CanvasCard
            title="Chroma Cb"
            badge="U"
            canvasRef={uCanvasRef}
            imgWidth={imgWidth}
            imgHeight={imgHeight}
            onClick={handleClick}
            overlay={renderOverlay()}
          />
          <CanvasCard
            title="Chroma Cr"
            badge="V"
            canvasRef={vCanvasRef}
            imgWidth={imgWidth}
            imgHeight={imgHeight}
            onClick={handleClick}
            overlay={renderOverlay()}
          />
        </div>
      ) : (
        <div style={{ maxWidth: '860px', margin: '0 auto', width: '100%' }}>
          {viewMode === 'composite' && (
            <CanvasCard
              title="Composite"
              badge="RGB"
              canvasRef={compositeCanvasRef}
              imgWidth={imgWidth}
              imgHeight={imgHeight}
              onClick={handleClick}
              overlay={renderOverlay()}
            />
          )}
          {viewMode === 'y' && (
            <CanvasCard
              title="Luma"
              badge="Y"
              canvasRef={yCanvasRef}
              imgWidth={imgWidth}
              imgHeight={imgHeight}
              onClick={handleClick}
              overlay={renderOverlay()}
            />
          )}
          {viewMode === 'u' && (
            <CanvasCard
              title="Chroma Cb"
              badge="U"
              canvasRef={uCanvasRef}
              imgWidth={imgWidth}
              imgHeight={imgHeight}
              onClick={handleClick}
              overlay={renderOverlay()}
            />
          )}
          {viewMode === 'v' && (
            <CanvasCard
              title="Chroma Cr"
              badge="V"
              canvasRef={vCanvasRef}
              imgWidth={imgWidth}
              imgHeight={imgHeight}
              onClick={handleClick}
              overlay={renderOverlay()}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default YUVViewer;
