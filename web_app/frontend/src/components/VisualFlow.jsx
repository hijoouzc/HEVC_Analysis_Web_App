import React from 'react';

const VisualFlow = ({ ctuX, ctuY, imagePreview, imagePreviewChroma, imageDims }) => {
  const origW = imageDims?.width || 640;
  const origH = imageDims?.height || 360;
  const chromaW = Math.max(1, Math.floor(origW / 2));
  const chromaH = Math.max(1, Math.floor(origH / 2));

  const scaleX = 256 / origW;
  const scaleY = 144 / origH;

  return (
    <div className="ctu-context-wrapper">
      <div className="full-image-box">
        <img src={imagePreview} alt="Full Frame" />
        <div 
          className="cu-highlight" 
          style={{ 
            left: `${ctuX * 64 * scaleX}px`, 
            top: `${ctuY * 64 * scaleY}px`,
            width: `${64 * scaleX}px`,
            height: `${64 * scaleY}px`
          }} 
        />
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.6 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>ZOOM 36×</span>
        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>→</span>
      </div>

      <div className="ctu-box" style={{ borderColor: 'var(--c-magenta)' }}>
        <img 
          src={imagePreview} 
          alt="8x8 Block RGB" 
          style={{ 
            width: `${origW}px`, 
            height: `${origH}px`, 
            transformOrigin: '0 0',
            transform: `scale(36) translate(-${ctuX * 64}px, -${ctuY * 64}px)` 
          }} 
        />
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.6 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>RGB → YUV</span>
        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>→</span>
      </div>

      <div className="ctu-info" style={{ maxWidth: '120px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>CU 8×8</div>
        <div style={{ fontSize: '0.75rem', color: '#666' }}>CTU [{ctuX}, {ctuY}]</div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 'bold', width: '20px' }}>Y</span>
          <div className="ctu-box" style={{ borderColor: 'var(--c-green)' }}>
            <img 
              src={imagePreview} 
              alt="Y" 
              style={{ 
                width: `${origW}px`, 
                height: `${origH}px`, 
                filter: 'grayscale(100%)', 
                transformOrigin: '0 0',
                transform: `scale(36) translate(-${ctuX * 64}px, -${ctuY * 64}px)` 
              }} 
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 'bold', width: '20px' }}>U</span>
          <div className="ctu-box" style={{ borderColor: '#00A3E0' }}>
            <img 
              src={imagePreviewChroma} 
              alt="U" 
              style={{ 
                width: `${chromaW}px`, 
                height: `${chromaH}px`, 
                filter: 'grayscale(100%) sepia(100%) hue-rotate(180deg) saturate(300%)', 
                transformOrigin: '0 0',
                transform: `scale(72) translate(-${ctuX * 32}px, -${ctuY * 32}px)` 
              }} 
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 'bold', width: '20px' }}>V</span>
          <div className="ctu-box" style={{ borderColor: '#DE006A' }}>
            <img 
              src={imagePreviewChroma} 
              alt="V" 
              style={{ 
                width: `${chromaW}px`, 
                height: `${chromaH}px`, 
                filter: 'grayscale(100%) sepia(100%) hue-rotate(300deg) saturate(300%)', 
                transformOrigin: '0 0',
                transform: `scale(72) translate(-${ctuX * 32}px, -${ctuY * 32}px)` 
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualFlow;
