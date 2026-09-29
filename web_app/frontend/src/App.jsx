import React, { useState, useEffect } from 'react';
import ChromaGrid from './components/ChromaGrid';
import ChromaPredGrid from './components/ChromaPredGrid';
import AngularCompass from './components/AngularCompass';
import IntraPredictionFlow from './components/IntraPredictionFlow';
import QuadTreeVisualizer from './components/QuadTreeVisualizer';
import TransformQuantVisualizer from './components/TransformQuantVisualizer';
import FullFrameViewer from './components/FullFrameViewer';
import Synchronized4WayViewport from './components/Synchronized4WayViewport';
import ModeComparisonModal from './components/ModeComparisonModal';
import { getIntraModeInfo } from './utils/colorUtils';
import './index.css';

function App() {
  const [file, setFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imagePreviewChroma, setImagePreviewChroma] = useState(null);
  const [rawImageDims, setRawImageDims] = useState({ width: 0, height: 0 });
  const [scaleMode, setScaleMode] = useState('native'); // 'native' (full 1:1 original) or 'fast' (640x360)
  const [imageDims, setImageDims] = useState({ width: 640, height: 360 });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [data, setData] = useState(null);
  const [refSamples, setRefSamples] = useState(null);
  const [currentModeIdx, setCurrentModeIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ctuX, setCtuX] = useState(0);
  const [ctuY, setCtuY] = useState(0);
  const [analyzedCtu, setAnalyzedCtu] = useState({ x: 0, y: 0 });
  const [hoveredLuma, setHoveredLuma] = useState(null);

  // Tab navigation: Clean single-view switcher
  const [activeStageTab, setActiveStageTab] = useState('MACRO');
  const [jobId, setJobId] = useState(null);
  const [partitionData, setPartitionData] = useState(null);
  const [transformData, setTransformData] = useState([]);
  const [quantData, setQuantData] = useState([]);
  const [selectedCu, setSelectedCu] = useState(null);
  const [ctuPartitionsMap, setCtuPartitionsMap] = useState({});

  // Auto-play mode loop
  useEffect(() => {
    let interval;
    if (isPlaying && data && data.length > 0) {
      interval = setInterval(() => {
        setCurrentModeIdx(prev => {
          if (prev >= data.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 750);
    }
    return () => clearInterval(interval);
  }, [isPlaying, data]);

  // Keyboard navigation shortcuts (Left, Right, Space)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (!data || data.length === 0) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentModeIdx(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentModeIdx(prev => Math.min(data.length - 1, prev + 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(p => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data]);

  const computeDims = (origW, origH, mode) => {
    if (!origW || !origH) return { width: 640, height: 360 };
    if (mode === 'fast' && (origW > 640 || origH > 360)) {
      const scale = Math.min(640 / origW, 360 / origH);
      const dw = Math.max(64, Math.round(Math.floor(origW * scale) / 8) * 8);
      const dh = Math.max(64, Math.round(Math.floor(origH * scale) / 8) * 8);
      return { width: dw, height: dh };
    }
    return {
      width: Math.max(64, Math.round(origW / 8) * 8),
      height: Math.max(64, Math.round(origH / 8) * 8)
    };
  };

  const handleScaleModeChange = (newMode) => {
    setScaleMode(newMode);
    if (rawImageDims.width > 0) {
      const newDims = computeDims(rawImageDims.width, rawImageDims.height, newMode);
      setImageDims(newDims);
      const maxCols = Math.max(1, Math.ceil(newDims.width / 64));
      const maxRows = Math.max(1, Math.ceil(newDims.height / 64));
      if (ctuX >= maxCols) setCtuX(0);
      if (ctuY >= maxRows) setCtuY(0);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErrorMsg(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const origW = img.naturalWidth || img.width;
          const origH = img.naturalHeight || img.height;
          setRawImageDims({ width: origW, height: origH });
          const dims = computeDims(origW, origH, scaleMode);
          setImageDims(dims);
          setImagePreview(event.target.result);

          // 4:2:0 subsampled chroma representation
          const canvasChroma = document.createElement('canvas');
          canvasChroma.width = Math.max(1, Math.floor(origW / 2));
          canvasChroma.height = Math.max(1, Math.floor(origH / 2));
          const ctxChroma = canvasChroma.getContext('2d');
          ctxChroma.drawImage(img, 0, 0, canvasChroma.width, canvasChroma.height);
          setImagePreviewChroma(canvasChroma.toDataURL('image/png'));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(selectedFile);
      setData(null);
    }
  };

  const handleUpload = async (e, customX = null, customY = null) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!file) return;
    const targetX = customX !== null ? customX : ctuX;
    const targetY = customY !== null ? customY : ctuY;
    if (customX !== null) setCtuX(customX);
    if (customY !== null) setCtuY(customY);
    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('ctu_x', targetX);
    formData.append('ctu_y', targetY);
    formData.append('scale_mode', scaleMode);

    try {
      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (result.status === 'success' && result.data && result.data.length > 0) {
        setData(result.data);
        if (result.ref_samples) setRefSamples(result.ref_samples);
        if (result.width && result.height) setImageDims({ width: result.width, height: result.height });
        setAnalyzedCtu({ x: targetX, y: targetY });
        setCurrentModeIdx(0);

        const currentJobId = result.job_id;
        if (currentJobId) {
          setJobId(currentJobId);
          fetch(`http://localhost:8000/api/v1/checkpoints/${currentJobId}/CP_01_PARTITION`)
            .then(r => r.ok ? r.json() : null)
            .then(p => {
              if (p) {
                const keyX = p.ctu_x !== undefined ? p.ctu_x : targetX;
                const keyY = p.ctu_y !== undefined ? p.ctu_y : targetY;
                const normalized = { ...p, ctu_x: keyX, ctu_y: keyY };
                setPartitionData(normalized);
                setCtuPartitionsMap(prev => ({
                  ...prev,
                  [`${keyX}_${keyY}`]: normalized
                }));
              }
            })
            .catch(err => console.warn("Failed fetching CP_01_PARTITION:", err));

          fetch(`http://localhost:8000/api/v1/checkpoints/${currentJobId}/partitions`)
            .then(r => r.ok ? r.json() : [])
            .then(parts => {
              if (Array.isArray(parts) && parts.length > 0) {
                setCtuPartitionsMap(prev => {
                  const updated = { ...prev };
                  parts.forEach(p => {
                    const kX = p.ctu_x !== undefined ? p.ctu_x : targetX;
                    const kY = p.ctu_y !== undefined ? p.ctu_y : targetY;
                    updated[`${kX}_${kY}`] = { ...p, ctu_x: kX, ctu_y: kY };
                  });
                  return updated;
                });
              }
            })
            .catch(err => console.warn("Failed fetching all partitions:", err));

          fetch(`http://localhost:8000/api/v1/checkpoints/${currentJobId}/CP_06_TRANSFORM`)
            .then(r => r.ok ? r.json() : [])
            .then(t => { if (t) setTransformData(t); })
            .catch(err => console.warn("Failed fetching CP_06_TRANSFORM:", err));

          fetch(`http://localhost:8000/api/v1/checkpoints/${currentJobId}/CP_07_QUANT`)
            .then(r => r.ok ? r.json() : [])
            .then(q => { if (q) setQuantData(q); })
            .catch(err => console.warn("Failed fetching CP_07_QUANT:", err));
        }
      } else {
        setErrorMsg(result.message || 'Failed to extract Intra Search data from HM encoder.');
      }
    } catch (err) {
      console.error("Upload failed", err);
      setErrorMsg('Cannot connect to backend server (http://localhost:8000).');
    }
    setLoading(false);
  };


  const currentMode = data && data[currentModeIdx];
  const currentModeInfo = currentMode ? getIntraModeInfo(currentMode.mode) : null;

  return (
    <div className="app-container" style={{ maxWidth: '1600px', padding: '1.25rem 2rem' }}>
      {/* Top Application Header */}
      <header className="header" style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem' }}>
        <div className="logo-container">
          <h1 style={{ fontSize: '1.4rem', letterSpacing: '0.04em' }}>HEVC Codec Analyzer</h1>
          <span style={{ fontSize: '0.75rem', color: '#666', fontFamily: 'JetBrains Mono' }}>
            HM-16.0 Reference Software Data-Flow Visualizer
          </span>
        </div>

        <div className="header-actions">
          {data && (
            <button
              className="reset-frame-btn"
              onClick={() => { setData(null); setIsPlaying(false); setCtuPartitionsMap({}); }}
              title="Select another image"
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}
            >
              [CHANGE IMAGE]
            </button>
          )}
        </div>
      </header>

      {errorMsg && (
        <div className="error-banner">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} title="Close">✕</button>
        </div>
      )}

      {/* SCREEN 1: UPLOAD & SETUP (When no analysis data yet) */}
      {!data && (
        <div className="workspace-layout">
          {/* Left Column: Input & Coordinates */}
          <div className="workspace-sidebar">
            <div className="sidebar-panel">
              <div className="sidebar-panel-title">
                <span>[INPUT SOURCE]</span>
              </div>
              
              <input
                type="file"
                id="file-upload"
                onChange={handleFileChange}
                accept="image/*"
                className="file-input"
              />
              <label htmlFor="file-upload" className="upload-label" style={{ padding: '1.25rem', minHeight: '90px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                    {file ? file.name : '[SELECT FILE]'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#777', marginTop: '0.2rem' }}>
                    {rawImageDims.width ? `${rawImageDims.width} × ${rawImageDims.height} px (Original)` : 'PNG, JPG, BMP'}
                  </div>
                </div>
              </label>

              {file && (rawImageDims.width > 640 || rawImageDims.height > 360) && (
                <div style={{ marginTop: '0.75rem', padding: '0.65rem', background: '#F8FAFC', border: '1px solid #CBD5E1' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem', fontFamily: 'JetBrains Mono' }}>
                    [RESOLUTION MODE]
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => handleScaleModeChange('native')}
                      style={{
                        flex: 1,
                        padding: '0.35rem 0.4rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        fontFamily: 'JetBrains Mono',
                        border: '1.5px solid var(--c-black)',
                        background: scaleMode === 'native' ? 'var(--c-black)' : 'var(--c-white)',
                        color: scaleMode === 'native' ? 'var(--c-white)' : 'var(--c-black)',
                        cursor: 'pointer'
                      }}
                      title="Process at full original resolution (1:1)"
                    >
                      ORIGINAL ({rawImageDims.width}×{rawImageDims.height})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScaleModeChange('fast')}
                      style={{
                        flex: 1,
                        padding: '0.35rem 0.4rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        fontFamily: 'JetBrains Mono',
                        border: '1.5px solid var(--c-black)',
                        background: scaleMode === 'fast' ? 'var(--c-black)' : 'var(--c-white)',
                        color: scaleMode === 'fast' ? 'var(--c-white)' : 'var(--c-black)',
                        cursor: 'pointer'
                      }}
                      title="Downscale to 640x360 for fast encode preview (<3s)"
                    >
                      FAST (640×360)
                    </button>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '0.35rem', fontFamily: 'JetBrains Mono' }}>
                    {scaleMode === 'native'
                      ? `Native: ${imageDims.width}×${imageDims.height} px (${Math.ceil(imageDims.width / 64)}×${Math.ceil(imageDims.height / 64)} = ${Math.ceil(imageDims.width / 64) * Math.ceil(imageDims.height / 64)} CTUs)`
                      : `Fast Preview: 640×360 px (10×6 = 60 CTUs)`}
                  </div>
                </div>
              )}
            </div>

            <div className="sidebar-panel">
              <div className="sidebar-panel-title">
                <span>[ANALYSIS TARGET]</span>
                <span style={{ color: 'var(--c-blue)', fontSize: '0.75rem', fontWeight: 800 }}>CTU ({ctuX}, {ctuY})</span>
              </div>

              <div style={{ padding: '0.65rem 0.75rem', background: 'var(--c-light-gray)', border: '1px solid #CBD5E1', marginBottom: '1rem', fontSize: '0.78rem', fontFamily: 'JetBrains Mono' }}>
                <div style={{ color: '#1E293B', fontWeight: 700 }}>Selected: CTU ({ctuX}, {ctuY})</div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.25rem' }}>
                  Click directly on any 64×64 CTU on the frame map to select your focus block.
                </div>
              </div>

              <button
                onClick={handleUpload}
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
                onSelectCTU={(x, y) => {
                  setCtuX(x);
                  setCtuY(y);
                  const cached = ctuPartitionsMap[`${x}_${y}`];
                  if (cached) {
                    setPartitionData(cached);
                  }
                }}
                partitionData={partitionData}
                ctuPartitionsMap={ctuPartitionsMap}
                isAnalyzed={!!file}
                onReAnalyze={(targetX, targetY) => {
                  handleUpload(null, targetX, targetY);
                }}
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
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.9rem', color: '#666' }}>
                  [Select an image from the sidebar to inspect frame structure]
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCREEN 2: ACTIVE WORKSPACE (2-Column Desktop IDE Layout) */}
      {data && data.length > 0 && currentMode && (
        <div className="workspace-layout">
          {/* Left Column: Fixed Sidebar Controls */}
          <div className="workspace-sidebar">
            {/* Panel 1: Target CTU Context */}
            <div className="sidebar-panel">
              <div className="sidebar-panel-title">
                <span>[ACTIVE CTU]</span>
                <span style={{ color: 'var(--c-blue)', fontWeight: 800 }}>({ctuX}, {ctuY})</span>
              </div>

              <div style={{ fontSize: '0.72rem', color: '#555', fontFamily: 'JetBrains Mono', marginBottom: '0.65rem' }}>
                Pixel: [{ctuX * 64}, {ctuY * 64}] (64×64 Block)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveStageTab('MACRO')}
                  style={{
                    width: '100%',
                    background: activeStageTab === 'MACRO' ? 'var(--c-black)' : 'var(--c-white)',
                    color: activeStageTab === 'MACRO' ? 'var(--c-white)' : 'var(--c-black)',
                    padding: '0.45rem',
                    border: '1.5px solid var(--c-black)',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    fontFamily: 'JetBrains Mono',
                    cursor: 'pointer'
                  }}
                  title="Switch to full-frame map to select CTU"
                >
                  SELECT ON FRAME MAP ↗
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cached = ctuPartitionsMap[`${ctuX}_${ctuY}`];
                    if (cached) setPartitionData(cached);
                    setActiveStageTab('CP_01');
                  }}
                  style={{
                    width: '100%',
                    background: activeStageTab === 'CP_01' ? 'var(--c-black)' : 'var(--c-white)',
                    color: activeStageTab === 'CP_01' ? 'var(--c-white)' : 'var(--c-black)',
                    padding: '0.45rem',
                    border: '1.5px solid var(--c-black)',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    fontFamily: 'JetBrains Mono',
                    cursor: 'pointer'
                  }}
                  title="View QuadTree partition tree for this CTU"
                >
                  VIEW QUADTREE ({ctuX}, {ctuY}) →
                </button>
              </div>
            </div>

            {/* Panel 2: Intra Mode Stepper & Controller */}
            <div className="sidebar-panel">
              <div className="sidebar-panel-title">
                <span>[MODE CONTROLLER]</span>
                <span style={{ color: 'var(--c-magenta)' }}>{data.length} MODES</span>
              </div>

              {/* Stepper Buttons */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <button
                  className="control-btn"
                  onClick={() => setCurrentModeIdx(Math.max(0, currentModeIdx - 1))}
                  disabled={currentModeIdx === 0}
                  title="Previous Mode (←)"
                  style={{ flex: 1, padding: '0.4rem' }}
                >
                  ←
                </button>
                <button
                  className="control-btn play-btn"
                  onClick={() => setIsPlaying(!isPlaying)}
                  title={isPlaying ? "Pause" : "Auto Play"}
                  style={{ flex: 1, padding: '0.4rem' }}
                >
                  {isPlaying ? '❚❚' : '▶'}
                </button>
                <button
                  className="control-btn"
                  onClick={() => setCurrentModeIdx(Math.min(data.length - 1, currentModeIdx + 1))}
                  disabled={currentModeIdx === data.length - 1}
                  title="Next Mode (→)"
                  style={{ flex: 1, padding: '0.4rem' }}
                >
                  →
                </button>
              </div>

              {/* Mode Select Dropdown */}
              <select
                value={currentModeIdx}
                onChange={e => setCurrentModeIdx(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  border: '2px solid var(--c-black)',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '0.75rem',
                  marginBottom: '0.75rem',
                  background: 'var(--c-white)'
                }}
              >
                {data.map((item, idx) => {
                  const info = getIntraModeInfo(item.mode);
                  return (
                    <option key={idx} value={idx}>
                      Mode {item.mode}: {info.name} — Cost: {item.cost.toFixed(1)}
                    </option>
                  );
                })}
              </select>

              {/* Compact Angular Compass */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <AngularCompass
                  currentMode={currentMode.mode}
                  onSelectMode={(targetMode) => {
                    const targetIdx = data.findIndex(d => d.mode === targetMode);
                    if (targetIdx !== -1) setCurrentModeIdx(targetIdx);
                  }}
                />
              </div>

              {/* Active Mode Info Badge */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                padding: '0.5rem',
                fontFamily: 'JetBrains Mono',
                fontSize: '0.75rem'
              }}>
                <div><strong>MODE {currentMode.mode}</strong>: {currentModeInfo?.name}</div>
                <div style={{ color: '#666', marginTop: '0.2rem' }}>
                  RD Cost: <strong style={{ color: 'var(--c-magenta)' }}>{currentMode.cost.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* Panel 3: Quick Metadata */}
            <div className="sidebar-panel">
              <div className="sidebar-panel-title">
                <span>[BLOCK STATS]</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontFamily: 'JetBrains Mono', fontSize: '0.72rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666' }}>CU Size:</span>
                  <strong>8×8 Luma</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666' }}>CTU Nodes:</span>
                  <strong>{partitionData?.total_nodes ?? '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666' }}>Transform TUs:</span>
                  <strong>{transformData?.length ?? '-'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Tabbed Main Workspace */}
          <div className="workspace-main">
            {/* Clean Tab Navigation Bar */}
            <div className="checkpoint-nav-bar" style={{ marginBottom: '1rem' }}>
              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'MACRO' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('MACRO')}
              >
                [MACRO FRAME]
              </button>

              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'CP_01' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('CP_01')}
              >
                [QUADTREE CTU]
              </button>

              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'INTRA_PIPE' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('INTRA_PIPE')}
              >
                [INTRA PIPELINE]
              </button>

              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'VIEW_4WAY' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('VIEW_4WAY')}
              >
                [4-WAY VIEW]
              </button>

              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'CP_06_07' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('CP_06_07')}
              >
                [TRANSFORM & QUANT]
              </button>

              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'CHROMA' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('CHROMA')}
              >
                [CHROMA Cb/Cr]
              </button>

              <button
                className={`checkpoint-tab-btn compare-btn ${activeStageTab === 'COMPARE' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('COMPARE')}
              >
                [COMPARE]
              </button>
            </div>

            {/* CTU Desync Notice: shown when user selects a different CTU on the macro map but has not re-analyzed */}
            {data && (ctuX !== analyzedCtu.x || ctuY !== analyzedCtu.y) && activeStageTab !== 'MACRO' && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.65rem 1rem',
                background: '#FEF3C7',
                border: '2px solid #D97706',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                fontFamily: 'JetBrains Mono',
                color: '#92400E'
              }}>
                <span>
                  Viewing detailed analysis for CTU ({analyzedCtu.x}, {analyzedCtu.y}). Selected CTU ({ctuX}, {ctuY}) not yet analyzed.
                </span>
                <button
                  type="button"
                  onClick={() => handleUpload(null, ctuX, ctuY)}
                  disabled={loading}
                  style={{
                    padding: '0.35rem 0.85rem',
                    background: '#D97706',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'JetBrains Mono'
                  }}
                >
                  {loading ? 'ANALYZING...' : `ANALYZE CTU (${ctuX}, ${ctuY})`}
                </button>
              </div>
            )}

            {/* TAB CONTENT: Only renders the strictly selected active tab */}

            {/* TAB 1: MACRO FRAME VIEWER (Default starting point) */}
            {activeStageTab === 'MACRO' && imagePreview && (
              <FullFrameViewer
                imageSrc={imagePreview}
                imageDims={imageDims}
                ctuX={ctuX}
                ctuY={ctuY}
                onSelectCTU={(x, y) => {
                  setCtuX(x);
                  setCtuY(y);
                  const cached = ctuPartitionsMap[`${x}_${y}`];
                  if (cached) {
                    setPartitionData(cached);
                  }
                }}
                onNavigateToQuadTree={(x, y) => {
                  setCtuX(x);
                  setCtuY(y);
                  const cached = ctuPartitionsMap[`${x}_${y}`];
                  if (cached) {
                    setPartitionData(cached);
                  }
                  setActiveStageTab('CP_01');
                }}
                partitionData={partitionData}
                ctuPartitionsMap={ctuPartitionsMap}
                isAnalyzed={true}
                onReAnalyze={(targetX, targetY) => {
                  handleUpload(null, targetX, targetY);
                }}
                loading={loading}
              />
            )}

            {/* TAB 2: QUADTREE PARTITIONING */}
            {activeStageTab === 'CP_01' && (
              <div className="stage-section-card">
                <div className="stage-section-header">
                  <div className="stage-section-title">
                    [CP_01] CTU QuadTree Partitioning Hierarchy
                  </div>
                  <span className="stage-badge-tag">STAGE 1</span>
                </div>
                <QuadTreeVisualizer
                  partitionData={partitionData}
                  ctuX={ctuX}
                  ctuY={ctuY}
                  onSelectCU={(node) => setSelectedCu(node)}
                  onNavigateToIntra={(node) => {
                    setSelectedCu(node);
                    if (node && node.intra_dir !== null && node.intra_dir !== undefined && data) {
                      const targetIdx = data.findIndex(d => d.mode === node.intra_dir);
                      if (targetIdx !== -1) setCurrentModeIdx(targetIdx);
                    }
                    setActiveStageTab('INTRA_PIPE');
                  }}
                  onBackToFrame={() => setActiveStageTab('MACRO')}
                />
              </div>
            )}

            {/* TAB 3: INTRA DETAILED PIPELINE */}
            {activeStageTab === 'INTRA_PIPE' && (
              <div className="stage-section-card">
                <div className="stage-section-header">
                  <div className="stage-section-title">
                    [CP_02-03] Reference Samples & Prediction Math
                  </div>
                  <span className="stage-badge-tag">STAGE 2 & 3</span>
                </div>
                <IntraPredictionFlow
                  modeData={currentMode}
                  refSamples={refSamples}
                  currentMode={currentMode.mode}
                  blockSize={selectedCu?.width || 8}
                  imagePreview={imagePreview}
                  imageDims={imageDims}
                  ctuX={ctuX}
                  ctuY={ctuY}
                  hoveredCoord={hoveredLuma}
                  onHoverCoord={setHoveredLuma}
                  onSelectMode={(targetMode) => {
                    const targetIdx = data.findIndex(d => d.mode === targetMode);
                    if (targetIdx !== -1) setCurrentModeIdx(targetIdx);
                  }}
                  onBackToQuadTree={() => setActiveStageTab('CP_01')}
                  onGoTo4Way={() => setActiveStageTab('VIEW_4WAY')}
                />
              </div>
            )}

            {/* TAB 4: 4-WAY SYNCHRONIZED VIEWPORT */}
            {activeStageTab === 'VIEW_4WAY' && (
              <Synchronized4WayViewport
                modeData={currentMode}
                currentMode={currentMode.mode}
                blockSize={selectedCu?.width || 8}
                ctuX={ctuX}
                ctuY={ctuY}
                onBackToIntra={() => setActiveStageTab('INTRA_PIPE')}
              />
            )}

            {/* TAB 5: TRANSFORM & QUANTIZATION */}
            {activeStageTab === 'CP_06_07' && (
              <div className="stage-section-card">
                <div className="stage-section-header">
                  <div className="stage-section-title">
                    [CP_06-07] 2D DCT/DST Spectrum & Forward Quantization
                  </div>
                  <span className="stage-badge-tag">STAGE 4 & 5</span>
                </div>
                <TransformQuantVisualizer
                  transformData={transformData}
                  quantData={quantData}
                  ctuX={ctuX}
                  ctuY={ctuY}
                  targetTuX={selectedCu?.x ?? null}
                  targetTuY={selectedCu?.y ?? null}
                />
              </div>
            )}

            {/* TAB 6: CHROMA CHANNELS */}
            {activeStageTab === 'CHROMA' && (
              <div className="stage-section-card">
                <div className="stage-section-header">
                  <div className="stage-section-title">
                    Chroma Cb/Cr Subsampled Channels (4:2:0)
                  </div>
                  <span className="stage-badge-tag">CHROMA</span>
                </div>

                <div className="channel-container" style={{ marginBottom: '1.5rem' }}>
                  <div className="channel-header">
                    <span className="channel-badge" style={{ background: '#F0F9FD', borderColor: 'var(--c-blue)' }}>
                      CHROMA Cb (BLUE-DIFFERENCE) — 4×4 SUBSAMPLED
                    </span>
                  </div>
                  <div className="grids-row">
                    <ChromaGrid label="Original (Cb)" dataArray={currentMode.org_u} isU={true} type="Org" imagePreviewChroma={imagePreviewChroma} ctuX={ctuX} ctuY={ctuY} imageDims={imageDims} />
                    <ChromaPredGrid label="Prediction (Cb)" predData={currentMode.pred_u} refTop={currentMode.ref_top_u} refLeft={currentMode.ref_left_u} isU={true} mode={currentMode.mode} />
                    <ChromaGrid label="Residual (Cb)" dataArray={currentMode.resi_u} isU={true} type="Resi" />
                  </div>
                </div>

                <div className="channel-container">
                  <div className="channel-header">
                    <span className="channel-badge" style={{ background: '#FDF2F7', borderColor: 'var(--c-magenta)' }}>
                      CHROMA Cr (RED-DIFFERENCE) — 4×4 SUBSAMPLED
                    </span>
                  </div>
                  <div className="grids-row">
                    <ChromaGrid label="Original (Cr)" dataArray={currentMode.org_v} isU={false} type="Org" imagePreviewChroma={imagePreviewChroma} ctuX={ctuX} ctuY={ctuY} imageDims={imageDims} />
                    <ChromaPredGrid label="Prediction (Cr)" predData={currentMode.pred_v} refTop={currentMode.ref_top_v} refLeft={currentMode.ref_left_v} isU={false} mode={currentMode.mode} />
                    <ChromaGrid label="Residual (Cr)" dataArray={currentMode.resi_v} isU={false} type="Resi" />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: MODE COMPARATOR */}
            {activeStageTab === 'COMPARE' && (
              <div className="stage-section-card">
                <div className="stage-section-header">
                  <div className="stage-section-title">
                    [COMPARE] Mode Differential Comparator
                  </div>
                  <span className="stage-badge-tag" style={{ background: '#FCE7F3', color: '#9D174D' }}>
                    DIAGNOSTIC
                  </span>
                </div>
                <ModeComparisonModal
                  isModal={false}
                  jobId={jobId}
                  modes={data}
                  initialModeA={data[0]?.mode ?? 0}
                  initialModeB={data[1]?.mode ?? 1}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
