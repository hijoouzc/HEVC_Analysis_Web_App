import React from 'react';
import { INTRA_PRED_ANGLES } from '../utils/intraTraceUtils';

/**
 * Minimalist HEVC Intra Angular Compass (56x56 SVG)
 * Maps all 33 angular directions (modes 2-34) and Planar (0), DC (1)
 */
const AngularCompass = ({ currentMode = 0, onSelectMode }) => {
  const size = 60;
  const center = size / 2;
  const radius = 24;

  // Calculate angle in radians for each mode
  const getModeAngleRad = (mode) => {
    if (mode === 0 || mode === 1) return null;
    const d = INTRA_PRED_ANGLES[mode] ?? 0;
    if (mode >= 18 && mode <= 34) {
      // Vertical: base is down (Math.PI / 2)
      return Math.PI / 2 - Math.atan(d / 32);
    } else {
      // Horizontal: base is right (0)
      return Math.atan(d / 32);
    }
  };

  const currentAngleRad = getModeAngleRad(currentMode);

  return (
    <div 
      className="compass-container" 
      title={`HEVC Angular Compass (Current Mode: ${currentMode})`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--c-white)',
        border: '2px solid var(--c-black)',
        width: `${size}px`,
        height: `${size}px`,
        boxSizing: 'border-box',
        cursor: 'pointer',
        userSelect: 'none'
      }}
    >
      <svg width={size - 4} height={size - 4} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer dial ring */}
        <circle 
          cx={center} 
          cy={center} 
          r={radius} 
          fill="#FFF" 
          stroke="#000" 
          strokeWidth="1.5" 
        />

        {/* 33 Angular mode ticks */}
        {Object.keys(INTRA_PRED_ANGLES).map((mStr) => {
          const m = Number(mStr);
          const rad = getModeAngleRad(m);
          if (rad === null) return null;

          const isSelected = currentMode === m;
          const isMajor = m === 10 || m === 26 || m === 18 || m === 2 || m === 34;

          const rInner = isSelected ? radius - 8 : (isMajor ? radius - 6 : radius - 4);
          const rOuter = radius;

          const x1 = center + Math.cos(rad) * rInner;
          const y1 = center + Math.sin(rad) * rInner;
          const x2 = center + Math.cos(rad) * rOuter;
          const y2 = center + Math.sin(rad) * rOuter;

          return (
            <line
              key={m}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isSelected ? 'var(--c-magenta)' : (isMajor ? '#000' : '#888')}
              strokeWidth={isSelected ? 2.5 : (isMajor ? 1.5 : 1)}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectMode) onSelectMode(m);
              }}
            >
              <title>Mode {m}</title>
            </line>
          );
        })}

        {/* Direction needle for angular modes */}
        {currentAngleRad !== null ? (
          <g>
            <line
              x1={center}
              y1={center}
              x2={center + Math.cos(currentAngleRad) * (radius - 5)}
              y2={center + Math.sin(currentAngleRad) * (radius - 5)}
              stroke="var(--c-magenta)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx={center} cy={center} r="3" fill="var(--c-magenta)" />
          </g>
        ) : (
          /* Non-angular indicator: Mode 0 (P) or Mode 1 (DC) */
          <g>
            <circle 
              cx={center} 
              cy={center} 
              r="10" 
              fill={currentMode === 0 ? '#EAF8D6' : '#E6F6FD'} 
              stroke="#000" 
              strokeWidth="1.5" 
            />
            <text 
              x={center} 
              y={center + 3.5} 
              textAnchor="middle" 
              fontSize="8" 
              fontWeight="700" 
              fontFamily="JetBrains Mono"
              fill="#000"
            >
              {currentMode === 0 ? 'P' : 'DC'}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default AngularCompass;
