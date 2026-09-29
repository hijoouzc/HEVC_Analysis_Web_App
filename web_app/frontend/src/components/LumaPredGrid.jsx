import React, { useState } from 'react';
import { getPixelTrace, getWavefrontDelay } from '../utils/intraTraceUtils';

const LumaPredGrid = ({ predData, refTop, refLeft, mode = 0, hoveredCoord, onHoverCoord }) => {
  const [hoveredPixel, setHoveredPixel] = useState(null);

  if (!predData || !refTop || !refLeft) return null;

  const effectiveHover = hoveredCoord || hoveredPixel;
  const trace = effectiveHover ? getPixelTrace(mode, effectiveHover.x, effectiveHover.y, 8, refTop, refLeft) : null;
  const activeTopIndices = new Set(trace ? trace.refs.filter(r => r.type === 'top').map(r => r.index) : []);
  const activeLeftIndices = new Set(trace ? trace.refs.filter(r => r.type === 'left').map(r => r.index) : []);

  const handleHover = (item) => {
    setHoveredPixel(item);
    if (onHoverCoord) onHoverCoord(item);
  };

  const getRefStyle = (val, isActive) => ({
    backgroundColor: `rgb(${val}, ${val}, ${val})`,
    color: val < 128 ? '#FFFFFF' : '#000000',
    border: isActive ? '2px solid #2563EB' : '1px solid #64748B',
    boxShadow: isActive ? '0 0 0 2px rgba(37, 99, 235, 0.4)' : 'none',
    transform: isActive ? 'scale(1.12)' : 'none',
    zIndex: isActive ? 12 : 2,
    transition: 'all 0.12s ease'
  });

  return (
    <div className="grid-wrapper">
      <h3 className="grid-title">Prediction (Y)</h3>
      <div 
        className="grid-container grid-17x17 pred-grid" 
        style={{ 
          position: 'relative',
          width: '374px',
          height: '374px'
        }}
        onMouseLeave={() => handleHover(null)}
      >
        {/* SVG Ray Tracing Layer */}
        {effectiveHover && trace && (
          <svg 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: 374, 
              height: 374, 
              pointerEvents: 'none', 
              zIndex: 11 
            }}
          >
            {trace.refs.map((ref, idx) => {
              const x2 = 22 * (effectiveHover.x + 1) + 11;
              const y2 = 22 * (effectiveHover.y + 1) + 11;
              const x1 = ref.type === 'top' ? 22 * ref.index + 11 : 11;
              const y1 = ref.type === 'left' ? 22 * ref.index + 11 : 11;

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
              cx={22 * (effectiveHover.x + 1) + 11} 
              cy={22 * (effectiveHover.y + 1) + 11} 
              r="3.5" 
              fill="#FFD200" 
              stroke="#000" 
              strokeWidth="1" 
            />
          </svg>
        )}

        {/* Border frame highlighting the 8x8 Prediction Block */}
        <div 
          style={{
            position: 'absolute',
            top: 22,
            left: 22,
            width: 176,
            height: 176,
            border: '2px solid var(--c-green)',
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
        
        {/* Direct Top (indices 1..8) */}
        {refTop.slice(1, 9).map((val, idx) => {
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
        
        {/* Extended Top-Right (indices 9..16) */}
        {refTop.slice(9).map((val, idx) => {
          const topIdx = idx + 9;
          const isActive = activeTopIndices.has(topIdx);
          return (
            <div 
              key={`top-ext-${idx}`} 
              className="cell ref-cell ref-extended" 
              style={{ gridColumn: idx + 10, gridRow: 1, ...getRefStyle(val, isActive) }} 
              title={`Top-Right Ext [${idx+8},-1]`}
            >
              {val}
            </div>
          );
        })}

        {/* Direct Left (indices 1..8) */}
        {refLeft.slice(1, 9).map((val, idx) => {
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

        {/* Extended Below-Left (indices 9..16) */}
        {refLeft.slice(9).map((val, idx) => {
          const leftIdx = idx + 9;
          const isActive = activeLeftIndices.has(leftIdx);
          return (
            <div 
              key={`left-ext-${idx}`} 
              className="cell ref-cell ref-extended" 
              style={{ gridColumn: 1, gridRow: idx + 10, ...getRefStyle(val, isActive) }} 
              title={`Below-Left Ext [-1,${idx+8}]`}
            >
              {val}
            </div>
          );
        })}
        
        {/* 8x8 Prediction block */}
        {predData.map((val, idx) => {
          const x = idx % 8;
          const y = Math.floor(idx / 8);
          const isHovered = effectiveHover && effectiveHover.x === x && effectiveHover.y === y;

          return (
            <div 
              key={`pred-${mode}-${idx}`} 
              className="cell pred-cell pred-cell-wave" 
              onMouseEnter={() => handleHover({ x, y, val })}
              style={{ 
                gridColumn: x + 2, 
                gridRow: y + 2, 
                backgroundColor: `rgb(${val}, ${val}, ${val})`, 
                color: val < 128 ? '#FFF' : '#000',
                cursor: 'crosshair',
                boxShadow: isHovered ? '0 0 0 2px #000, 0 0 0 3px #FFD200' : 'none',
                zIndex: isHovered ? 12 : 1,
                transform: isHovered ? 'scale(1.08)' : 'none',
                transition: 'all 0.1s ease',
                animationDelay: `${getWavefrontDelay(mode, x, y, 8)}s`
              }}
            >
              {val}
            </div>
          );
        })}

        {/* Bottom-right info / traceback box */}
        {effectiveHover && trace ? (
          <div 
            style={{
              gridColumn: '10 / span 8',
              gridRow: '10 / span 8',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#FFF',
              border: '2px solid var(--c-black)',
              padding: '8px',
              textAlign: 'center',
              userSelect: 'none',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--c-black)' }}>
              [{effectiveHover.x}, {effectiveHover.y}] = {effectiveHover.val ?? predData[effectiveHover.y * 8 + effectiveHover.x]}
            </div>
            <div style={{ fontSize: '0.64rem', color: '#444', marginTop: '4px', lineHeight: 1.25, fontWeight: 500 }}>
              {trace.text}
            </div>
          </div>
        ) : (
          <div 
            style={{
              gridColumn: '10 / span 8',
              gridRow: '10 / span 8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.01)',
              userSelect: 'none'
            }}
          >
            <span style={{ fontSize: '0.68rem', color: '#AAA' }}>
              Hover to trace
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LumaPredGrid;
