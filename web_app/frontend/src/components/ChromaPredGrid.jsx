import React, { useState } from 'react';
import { getChromaColorAndTextColor } from '../utils/colorUtils';
import { getPixelTrace, getWavefrontDelay } from '../utils/intraTraceUtils';

const ChromaPredGrid = ({ label, predData, refTop, refLeft, isU, mode = 0 }) => {
  const [hoveredPixel, setHoveredPixel] = useState(null);

  if (!predData || !refTop || !refLeft) return null;
  
  const trace = hoveredPixel ? getPixelTrace(mode, hoveredPixel.x, hoveredPixel.y, 4, refTop, refLeft) : null;
  const activeTopIndices = new Set(trace ? trace.refs.filter(r => r.type === 'top').map(r => r.index) : []);
  const activeLeftIndices = new Set(trace ? trace.refs.filter(r => r.type === 'left').map(r => r.index) : []);

  const refBorderColor = isU ? '#F58220' : '#0088D6';

  const getRefStyle = (val, isActive) => {
    const { bg, color } = getChromaColorAndTextColor(val, isU);
    return {
      backgroundColor: bg,
      color: color,
      border: isActive ? '2px solid #2563EB' : `1.5px solid ${refBorderColor}`,
      boxShadow: isActive ? '0 0 0 2px rgba(37, 99, 235, 0.4)' : 'none',
      transform: isActive ? 'scale(1.1)' : 'none',
      zIndex: isActive ? 12 : 2,
      transition: 'all 0.12s ease',
      fontSize: '0.72rem',
      fontWeight: 700,
      letterSpacing: '-0.5px',
      lineHeight: 1,
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box'
    };
  };

  return (
    <div className="grid-wrapper">
      <h3 className="grid-title">{label}</h3>
      <div 
        className="grid-container grid-9x9 pred-grid" 
        style={{ 
          position: 'relative',
          width: '288px',
          height: '288px'
        }}
        onMouseLeave={() => setHoveredPixel(null)}
      >
        {/* SVG Ray Tracing Layer */}
        {hoveredPixel && trace && (
          <svg 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: 288, 
              height: 288, 
              pointerEvents: 'none', 
              zIndex: 11 
            }}
          >
            {trace.refs.map((ref, idx) => {
              const x2 = 32 * (hoveredPixel.x + 1) + 16;
              const y2 = 32 * (hoveredPixel.y + 1) + 16;
              const x1 = ref.type === 'top' ? 32 * ref.index + 16 : 16;
              const y1 = ref.type === 'left' ? 32 * ref.index + 16 : 16;

              return (
                <g key={idx}>
                  <line 
                    x1={x1} 
                    y1={y1} 
                    x2={x2} 
                    y2={y2} 
                    stroke="#FFD200" 
                    strokeWidth="2" 
                    strokeDasharray="3 2" 
                  />
                  <circle cx={x1} cy={y1} r="3.5" fill="#FFD200" stroke="#000" strokeWidth="1" />
                </g>
              );
            })}
            <circle 
              cx={32 * (hoveredPixel.x + 1) + 16} 
              cy={32 * (hoveredPixel.y + 1) + 16} 
              r="3.5" 
              fill="#FFD200" 
              stroke="#000" 
              strokeWidth="1" 
            />
          </svg>
        )}

        {/* Border frame highlighting the 4x4 Prediction Block */}
        <div 
          style={{
            position: 'absolute',
            top: 32,
            left: 32,
            width: 128,
            height: 128,
            border: isU ? '2px solid #00A3E0' : '2px solid #DE006A',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: 10
          }} 
        />

        {/* Top-Left Corner Reference */}
        <div 
          className="cell ref-cell" 
          style={{ 
            gridColumn: 1, 
            gridRow: 1, 
            ...getRefStyle(refTop[0], activeTopIndices.has(0) || activeLeftIndices.has(0)), 
            borderWidth: '2.5px' 
          }} 
          title="Top-Left [-1,-1]"
        >
          {refTop[0]}
        </div>
        
        {/* Direct Top (indices 1..4) */}
        {refTop.slice(1, 5).map((val, idx) => {
          const topIdx = idx + 1;
          const isActive = activeTopIndices.has(topIdx);
          return (
            <div 
              key={`top-${idx}`} 
              className="cell ref-cell" 
              style={{ gridColumn: idx + 2, gridRow: 1, ...getRefStyle(val, isActive) }} 
              title={`Top [${idx},-1]`}
            >
              {val}
            </div>
          );
        })}
        
        {/* Extended Top-Right (indices 5..8) */}
        {refTop.slice(5).map((val, idx) => {
          const topIdx = idx + 5;
          const isActive = activeTopIndices.has(topIdx);
          return (
            <div 
              key={`top-ext-${idx}`} 
              className="cell ref-cell ref-extended" 
              style={{ gridColumn: idx + 6, gridRow: 1, ...getRefStyle(val, isActive) }} 
              title={`Top-Right Ext [${idx+4},-1]`}
            >
              {val}
            </div>
          );
        })}

        {/* Direct Left (indices 1..4) */}
        {refLeft.slice(1, 5).map((val, idx) => {
          const leftIdx = idx + 1;
          const isActive = activeLeftIndices.has(leftIdx);
          return (
            <div 
              key={`left-${idx}`} 
              className="cell ref-cell" 
              style={{ gridColumn: 1, gridRow: idx + 2, ...getRefStyle(val, isActive) }} 
              title={`Left [-1,${idx}]`}
            >
              {val}
            </div>
          );
        })}
        
        {/* Extended Below-Left (indices 5..8) */}
        {refLeft.slice(5).map((val, idx) => {
          const leftIdx = idx + 5;
          const isActive = activeLeftIndices.has(leftIdx);
          return (
            <div 
              key={`left-ext-${idx}`} 
              className="cell ref-cell ref-extended" 
              style={{ gridColumn: 1, gridRow: idx + 6, ...getRefStyle(val, isActive) }} 
              title={`Below-Left Ext [-1,${idx+4}]`}
            >
              {val}
            </div>
          );
        })}

        {/* 4x4 Prediction block */}
        {predData.map((val, idx) => {
          const x = idx % 4;
          const y = Math.floor(idx / 4);
          const { bg, color } = getChromaColorAndTextColor(val, isU);
          const isHovered = hoveredPixel && hoveredPixel.x === x && hoveredPixel.y === y;
          
          return (
            <div 
              key={`pred-${mode}-${idx}`} 
              className="cell pred-cell pred-cell-wave" 
              onMouseEnter={() => setHoveredPixel({ x, y, val })}
              style={{ 
                gridColumn: x + 2, 
                gridRow: y + 2, 
                backgroundColor: bg, 
                color: color,
                cursor: 'crosshair',
                boxShadow: isHovered ? '0 0 0 2px #000, 0 0 0 3px #FFD200' : 'none',
                zIndex: isHovered ? 12 : 1,
                transform: isHovered ? 'scale(1.08)' : 'none',
                transition: 'all 0.1s ease',
                animationDelay: `${getWavefrontDelay(mode, x, y, 4)}s`,
                fontSize: '0.85rem',
                fontWeight: 600,
                letterSpacing: '-0.5px',
                lineHeight: 1,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box'
              }}
            >
              {val}
            </div>
          );
        })}

        {/* Bottom-right info / traceback box */}
        {hoveredPixel && trace ? (
          <div 
            style={{
              gridColumn: '6 / span 4',
              gridRow: '6 / span 4',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#FFF',
              border: '2px solid var(--c-black)',
              padding: '6px',
              textAlign: 'center',
              userSelect: 'none',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--c-black)' }}>
              [{hoveredPixel.x}, {hoveredPixel.y}] = {hoveredPixel.val}
            </div>
            <div style={{ fontSize: '0.62rem', color: '#444', marginTop: '3px', lineHeight: 1.25, fontWeight: 500 }}>
              {trace.text}
            </div>
          </div>
        ) : (
          <div 
            style={{
              gridColumn: '6 / span 4',
              gridRow: '6 / span 4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.01)',
              userSelect: 'none'
            }}
          >
            <span style={{ fontSize: '0.65rem', color: '#AAA' }}>
              Hover to trace
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChromaPredGrid;
