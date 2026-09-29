import React from 'react';

const LumaGrid = ({ label, dataArray, isResi, imagePreview, ctuX, ctuY, imageDims, hoveredCoord, onHoverCoord }) => {
  const isOrg = label.includes('Original') || label.includes('Org');
  const origW = imageDims?.width || 640;
  const origH = imageDims?.height || 360;
  
  return (
    <div className="grid-wrapper">
      <h3 className="grid-title">{label}</h3>
      <div className="grid-container grid-8x8" style={{ position: 'relative', overflow: 'hidden', border: isOrg ? '2px solid var(--c-green)' : '2px solid var(--c-black)' }}>
        
        {isOrg && imagePreview && (
          <img 
            src={imagePreview} 
            alt="Luma Y" 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${origW}px`,
              height: `${origH}px`,
              transformOrigin: '0 0',
              transform: `scale(36) translate(-${ctuX * 64}px, -${ctuY * 64}px)`,
              zIndex: 0,
              imageRendering: 'pixelated',
              filter: 'grayscale(100%)'
            }}
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 36px)', gridTemplateRows: 'repeat(8, 36px)', position: 'relative', zIndex: 1 }}>
          {dataArray.map((val, idx) => {
            const x = idx % 8;
            const y = Math.floor(idx / 8);
            const isHovered = hoveredCoord && hoveredCoord.x === x && hoveredCoord.y === y;

            let bg = '';
            let color = '';
            if (isResi) {
              if (val === 0) {
                bg = '#E6E6E6';
                color = '#B7B7B7';
              } else {
                const intensity = Math.min(1, Math.abs(val) / 64);
                bg = val > 0 ? `rgba(222, 0, 106, ${intensity})` : `rgba(245, 130, 32, ${intensity})`; // Magenta for +, Orange for -
                color = intensity > 0.5 ? '#FFF' : '#000';
              }
            } else if (isOrg) {
              bg = 'transparent';
              color = '#FFF';
            } else {
              bg = `rgb(${val}, ${val}, ${val})`;
              color = val < 128 ? '#FFF' : '#000';
            }
            
            return (
              <div 
                key={idx} 
                className={`cell ${isResi && val !== 0 ? 'resi-non-zero' : ''} ${isOrg ? 'org-cell' : ''}`}
                onMouseEnter={() => onHoverCoord && onHoverCoord({ x, y, val })}
                onMouseLeave={() => onHoverCoord && onHoverCoord(null)}
                style={{ 
                  backgroundColor: bg, 
                  color: color,
                  cursor: 'crosshair',
                  boxShadow: isHovered ? '0 0 0 2px #000, 0 0 0 3px #FFD200' : 'none',
                  zIndex: isHovered ? 10 : 1,
                  transform: isHovered ? 'scale(1.08)' : 'none',
                  transition: 'all 0.1s ease'
                }}
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

export default LumaGrid;
