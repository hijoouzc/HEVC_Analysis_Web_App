import React from 'react';
import FullFrameViewer from '../FullFrameViewer';

/**
 * SetupScreen
 * Screen 1: File selection, resolution scaling choice (Native 1:1 vs Fast 640x360),
 * target CTU focus coordinate picker, and full-frame visualizer.
 */
const SetupScreen = ({
  file,
  rawImageDims,
  imageDims,
  ctuX,
  ctuY,
  loading,
  imagePreview,
  partitionData,
  ctuPartitionsMap,
  onFileChange,
  onSelectCTU,
  onReAnalyze,
  onUpload
}) => {
  return (
    <div className="workspace-layout">
      {/* Left Column: Input Source & Target Coordinates */}
      <div className="workspace-sidebar">
        <div className="sidebar-panel">
          <div className="sidebar-panel-title">
            <span>Source Image</span>
          </div>

          <input
            type="file"
            id="file-upload"
            onChange={onFileChange}
            accept="image/*"
            className="file-input"
          />
          <label htmlFor="file-upload" className="upload-label" style={{ padding: '1.25rem', minHeight: '90px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                {file ? file.name : 'Select Image'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#777', marginTop: '0.2rem' }}>
                {rawImageDims.width ? `${rawImageDims.width} × ${rawImageDims.height}` : 'PNG, JPG, BMP'}
              </div>
            </div>
          </label>

          {file && rawImageDims.width > 0 && (
            <div style={{ marginTop: '0.75rem', padding: '0.65rem', background: '#F8FAFC', border: '1px solid #CBD5E1' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '0.2rem', fontFamily: 'JetBrains Mono' }}>
                Resolution
              </div>
              <div style={{ fontSize: '0.72rem', color: '#1E293B', fontFamily: 'JetBrains Mono' }}>
                {imageDims.width} × {imageDims.height} • {Math.ceil(imageDims.width / 64)} × {Math.ceil(imageDims.height / 64)} CTUs
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-panel">
          <div className="sidebar-panel-title">
            <span>Target CTU</span>
            <span style={{ color: 'var(--c-blue)', fontSize: '0.75rem', fontWeight: 800 }}>
              {ctuX !== null && ctuY !== null ? `(${ctuX}, ${ctuY})` : '(0, 0)'}
            </span>
          </div>

          <div style={{ padding: '0.65rem 0.75rem', background: 'var(--c-light-gray)', border: '1px solid #CBD5E1', marginBottom: '1rem', fontSize: '0.75rem', fontFamily: 'JetBrains Mono' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>Coordinates:</span>
              <span style={{ color: '#1E293B', fontWeight: 700 }}>
                {ctuX !== null && ctuY !== null ? `(${ctuX}, ${ctuY})` : '(0, 0)'}
              </span>
            </div>
          </div>

          <button
            onClick={onUpload}
            disabled={!file || loading}
            className={`action-btn ${loading ? 'loading' : ''}`}
            style={{ width: '100%', padding: '0.75rem', fontSize: '0.88rem', fontWeight: 800 }}
          >
            {loading ? 'ENCODING FULL FRAME...' : 'START HEVC ANALYSIS →'}
          </button>
        </div>
      </div>

      {/* Right Column: Interactive Frame Preview */}
      <div className="workspace-main">
        {imagePreview ? (
          <FullFrameViewer
            imageSrc={imagePreview}
            imageDims={imageDims}
            ctuX={ctuX}
            ctuY={ctuY}
            onSelectCTU={onSelectCTU}
            partitionData={partitionData}
            ctuPartitionsMap={ctuPartitionsMap}
            isAnalyzed={false}
            onReAnalyze={onReAnalyze}
            loading={loading}
          />
        ) : (
          <div style={{
            background: 'var(--c-white)',
            border: '2px solid var(--c-black)',
            padding: '4rem 2rem',
            textAlign: 'center',
            boxShadow: '4px 4px 0px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.9rem', color: '#64748B', fontWeight: 700 }}>
              No image loaded
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(SetupScreen);
