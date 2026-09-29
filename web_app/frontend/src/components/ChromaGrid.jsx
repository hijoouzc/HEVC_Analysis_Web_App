import React from 'react';
import { getChromaColorAndTextColor } from '../utils/colorUtils';

const ChromaGrid = ({ label, dataArray, isU, type, imagePreviewChroma, ctuX, ctuY, imageDims }) => {
  if (!dataArray || dataArray.length === 0) return null;
  
  const cssFilter = isU 
    ? 'grayscale(100%) sepia(100%) hue-rotate(180deg) saturate(300%)' // Blue tint
    : 'grayscale(100%) sepia(100%) hue-rotate(300deg) saturate(300%)'; // Pink/Red tint
    
  const isOrg = type === 'Org';
  const isResi = type === 'Resi';
  const origW = imageDims?.width || 640;
  const origH = imageDims?.height || 360;
  const chromaW = Math.max(1, Math.floor(origW / 2));
  const chromaH = Math.max(1, Math.floor(origH / 2));
  
  return (
    <div className="grid-wrapper">
      <h3 className="grid-title">{label}</h3>
      <div className="grid-container grid-4x4" style={{ position: 'relative', overflow: 'hidden', border: isU ? '2px solid #00A3E0' : '2px solid #DE006A', width: '288px', height: '288px' }}>
        
        {isOrg && imagePreviewChroma && (
          <img 
            src={imagePreviewChroma} 
            alt={label} 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${chromaW}px`,
              height: `${chromaH}px`,
              transformOrigin: '0 0',
              transform: `scale(72) translate(-${ctuX * 32}px, -${ctuY * 32}px)`,
              zIndex: 0,
              imageRendering: 'pixelated',
              filter: cssFilter
            }}
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 72px)', gridTemplateRows: 'repeat(4, 72px)', width: '288px', height: '288px', position: 'relative', zIndex: 1 }}>
          {dataArray.map((val, idx) => {
            let bg = '';
            let color = '';
            
            if (isOrg) {
              bg = 'transparent';
              color = '#FFF';
            } else if (isResi) {
              if (val === 0) {
                bg = '#E6E6E6';
                color = '#B7B7B7';
              } else {
                const intensity = Math.min(1, Math.abs(val) / 64);
                bg = val > 0 ? `rgba(222, 0, 106, ${intensity})` : `rgba(245, 130, 32, ${intensity})`; // Magenta for +, Orange for -
                color = intensity > 0.5 ? '#FFF' : '#000';
              }
            } else {
              const { bg: cBg, color: cColor } = getChromaColorAndTextColor(val, isU);
              bg = cBg;
              color = cColor;
            }
            
            return (
              <div 
                key={idx} 
                className={`cell ${isResi && val !== 0 ? 'resi-non-zero' : ''} ${isOrg ? 'org-cell' : ''}`}
                style={{ backgroundColor: bg, color: color }}
              >
                {val}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChromaGrid;
