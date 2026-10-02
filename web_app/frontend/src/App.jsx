import React, { useState, useEffect, useMemo, useCallback } from 'react';
import SetupScreen from './components/app/SetupScreen';
import AnalysisSidebar from './components/app/AnalysisSidebar';
import IntraPredictionFlow from './components/IntraPredictionFlow';
import QuadTreeVisualizer from './components/QuadTreeVisualizer';
import TransformQuantVisualizer from './components/TransformQuantVisualizer';
import FullFrameViewer from './components/FullFrameViewer';
import Synchronized4WayViewport from './components/Synchronized4WayViewport';
import YUVViewer from './components/YUVViewer';
import FourPictureComparison from './components/FourPictureComparison';
import { getIntraModeInfo } from './utils/colorUtils';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function App() {
  const [file, setFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [rawImageDims, setRawImageDims] = useState({ width: 0, height: 0 });
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
  const [cuSize, setCuSize] = useState(8);
  const [analyzedCuSize, setAnalyzedCuSize] = useState(8);

  // Tab navigation: Clean single-view switcher
  const [activeStageTab, setActiveStageTab] = useState('MACRO');
  const [jobId, setJobId] = useState(null);
  const [partitionData, setPartitionData] = useState(null);
  const [transformData, setTransformData] = useState([]);
  const [quantData, setQuantData] = useState([]);
  const [selectedCu, setSelectedCu] = useState(null);
  const [ctuPartitionsMap, setCtuPartitionsMap] = useState({});
  const [ctuAnalysisCache, setCtuAnalysisCache] = useState({});

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

  const computeDims = useCallback((origW, origH) => {
    if (!origW || !origH) return { width: 640, height: 360 };
    return {
      width: Math.max(64, Math.round(origW / 8) * 8),
      height: Math.max(64, Math.round(origH / 8) * 8)
    };
  }, []);

  const handleFileChange = useCallback((e) => {
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
          const dims = computeDims(origW, origH);
          setImageDims(dims);
          setImagePreview(event.target.result);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(selectedFile);
      setData(null);
      setPartitionData(null);
      setSelectedCu(null);
      setRefSamples(null);
      setTransformData([]);
      setQuantData([]);
      setJobId(null);
      setCtuPartitionsMap({});
      setCtuAnalysisCache({});
    }
  }, [computeDims]);

  const handleUpload = useCallback(async (e, customX = null, customY = null, customCuSize = null, targetMode = null) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!file) return;
    const targetX = customX !== null ? customX : (ctuX !== null ? ctuX : 0);
    const targetY = customY !== null ? customY : (ctuY !== null ? ctuY : 0);
    const targetCuSize = customCuSize !== null ? customCuSize : (cuSize !== null ? cuSize : 8);

    setCtuX(targetX);
    setCtuY(targetY);
    setCuSize(targetCuSize);

    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('ctu_x', targetX);
    formData.append('ctu_y', targetY);
    formData.append('cu_size', targetCuSize);
    formData.append('scale_mode', 'native');

    try {
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      let result;
      try {
        result = await res.json();
      } catch {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText || 'Invalid response'}`);
      }

      if (res.ok && result.status === 'success' && result.data && result.data.length > 0) {
        setData(result.data);
        if (result.ref_samples) setRefSamples(result.ref_samples);
        if (result.width && result.height) setImageDims({ width: result.width, height: result.height });
        setAnalyzedCtu({ x: targetX, y: targetY });
        setAnalyzedCuSize(targetCuSize);

        // Store analysis in fast client cache for 0ms instant reload on revisit
        setCtuAnalysisCache(prev => ({
          ...prev,
          [`${targetX}_${targetY}_${targetCuSize}`]: {
            data: result.data,
            refSamples: result.ref_samples || null,
            bestMode: result.best_mode,
            bestCost: result.best_cost,
            jobId: result.job_id
          }
        }));

        // Intelligently select active mode
        if (targetMode !== null && targetMode !== undefined) {
          const idx = result.data.findIndex(d => d.mode === targetMode);
          setCurrentModeIdx(idx !== -1 ? idx : 0);
        } else {
          const prevMode = (data && data[currentModeIdx]) ? data[currentModeIdx].mode : 0;
          const idx = result.data.findIndex(d => d.mode === prevMode);
          setCurrentModeIdx(idx !== -1 ? idx : 0);
        }

        const currentJobId = result.job_id;
        if (currentJobId) {
          setJobId(currentJobId);

          // Concurrently fetch all stages for full synchronization
          Promise.all([
            fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_01_PARTITION`).then(r => r.ok ? r.json() : null),
            fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/partitions`).then(r => r.ok ? r.json() : []),
            fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_02_INTRA_REF?cu_size=${targetCuSize}`).then(r => r.ok ? r.json() : null),
            fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_06_TRANSFORM`).then(r => r.ok ? r.json() : []),
            fetch(`${API_BASE_URL}/api/v1/checkpoints/${currentJobId}/CP_07_QUANT`).then(r => r.ok ? r.json() : [])
          ]).then(([p, allParts, ref, transform, quant]) => {
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
            if (Array.isArray(allParts) && allParts.length > 0) {
              setCtuPartitionsMap(prev => {
                const updated = { ...prev };
                allParts.forEach(part => {
                  const kX = part.ctu_x !== undefined ? part.ctu_x : targetX;
                  const kY = part.ctu_y !== undefined ? part.ctu_y : targetY;
                  updated[`${kX}_${kY}`] = { ...part, ctu_x: kX, ctu_y: kY };
                });
                return updated;
              });
            }
            if (ref) setRefSamples(ref);
            if (Array.isArray(transform) && transform.length > 0) setTransformData(transform);
            if (Array.isArray(quant) && quant.length > 0) setQuantData(quant);
          }).catch(err => console.warn("Failed fetching checkpoints:", err));
        }
      } else {
        const errorDetail = result?.detail || result?.message || 'Failed to extract Intra Search data from HM encoder.';
        setErrorMsg(errorDetail);
      }
    } catch (err) {
      console.error("Upload failed", err);
      setErrorMsg(err.message?.includes('Server returned') ? err.message : `Cannot connect to backend server (${API_BASE_URL}).`);
    }
    setLoading(false);
  }, [file, ctuX, ctuY, cuSize, data, currentModeIdx]);

  const safeModeIdx = (data && data.length > 0) ? Math.min(Math.max(0, currentModeIdx), data.length - 1) : 0;
  const currentMode = (data && data.length > 0) ? data[safeModeIdx] : null;
  const currentModeInfo = useMemo(() => {
    return currentMode ? getIntraModeInfo(currentMode.mode) : null;
  }, [currentMode]);

  const handleResetImage = useCallback(() => {
    setData(null);
    setIsPlaying(false);
    setPartitionData(null);
    setSelectedCu(null);
    setRefSamples(null);
    setTransformData([]);
    setQuantData([]);
    setJobId(null);
    setErrorMsg(null);
    setCtuPartitionsMap({});
    setCtuAnalysisCache({});
  }, []);

  const handleSelectCU = useCallback((cu) => {
    setSelectedCu(prev => {
      if (!cu) return null;
      if (prev && prev.x === cu.x && prev.y === cu.y && prev.width === cu.width) {
        return null;
      }
      return cu;
    });
  }, []);

  const handleSelectCTU = useCallback((x, y) => {
    setCtuX(x);
    setCtuY(y);
    if (x === null || y === null) {
      return;
    }
    const cachedPart = ctuPartitionsMap[`${x}_${y}`];
    if (cachedPart) setPartitionData(cachedPart);

    // Instant restoration from analysis cache if this CTU was previously analyzed
    const cachedAnalysis = ctuAnalysisCache[`${x}_${y}_${cuSize}`];
    if (cachedAnalysis) {
      setData(cachedAnalysis.data);
      if (cachedAnalysis.refSamples) setRefSamples(cachedAnalysis.refSamples);
      if (cachedAnalysis.jobId) setJobId(cachedAnalysis.jobId);
      setAnalyzedCtu({ x, y });
    }
  }, [ctuPartitionsMap, ctuAnalysisCache, cuSize]);

  const hasDesync = data && ctuX !== null && ctuY !== null && (ctuX !== analyzedCtu.x || ctuY !== analyzedCtu.y);

  return (
    <div className="app-container" style={{ maxWidth: '1600px', padding: '1.25rem 2rem' }}>
      {/* Top Application Header */}
      <header className="header" style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem' }}>
        <div className="logo-container">
          <h1 style={{ fontSize: '1.35rem', letterSpacing: '-0.02em', fontWeight: 700 }}>HEVC Video Analyzer</h1>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'JetBrains Mono' }}>
            HM-16.0 Reference Software
          </span>
        </div>

        <div className="header-actions">
          {data && (
            <button
              className="reset-frame-btn"
              onClick={handleResetImage}
              title="Select another image"
              style={{ fontSize: '0.76rem', padding: '0.35rem 0.75rem', fontWeight: 600 }}
            >
              Change Image
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
        <SetupScreen
          file={file}
          rawImageDims={rawImageDims}
          imageDims={imageDims}
          ctuX={ctuX}
          ctuY={ctuY}
          loading={loading}
          imagePreview={imagePreview}
          partitionData={partitionData}
          ctuPartitionsMap={ctuPartitionsMap}
          onFileChange={handleFileChange}
          onSelectCTU={handleSelectCTU}
          onReAnalyze={(targetX, targetY) => {
            handleUpload(null, targetX, targetY);
          }}
          onUpload={handleUpload}
        />
      )}

      {/* SCREEN 2: ACTIVE WORKSPACE (2-Column Desktop IDE Layout) */}
      {data && data.length > 0 && currentMode && (
        <div className="workspace-layout">
          {/* Left Column: Fixed Sidebar Controls */}
          <AnalysisSidebar
            ctuX={ctuX}
            ctuY={ctuY}
            activeStageTab={activeStageTab}
            onNavigateTab={setActiveStageTab}
            ctuPartitionsMap={ctuPartitionsMap}
            setPartitionData={setPartitionData}
            data={data}
            currentModeIdx={currentModeIdx}
            setCurrentModeIdx={setCurrentModeIdx}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            currentMode={currentMode}
            currentModeInfo={currentModeInfo}
            selectedCu={selectedCu}
            analyzedCuSize={analyzedCuSize}
          />

          {/* Right Column: Clean Tabbed Main Workspace */}
          <div className="workspace-main">
            {/* Clean Tab Navigation Bar */}
            <div className="checkpoint-nav-bar" style={{ marginBottom: '1rem' }}>
              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'MACRO' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('MACRO')}
              >
                Frame
              </button>

              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'YUV_VIEW' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('YUV_VIEW')}
              >
                YUV Planes
              </button>

              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'CP_01' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('CP_01')}
              >
                QuadTree
              </button>

              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'INTRA_PIPE' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('INTRA_PIPE')}
              >
                Intra Prediction
              </button>

              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'CP_06_07' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('CP_06_07')}
              >
                Transform & Quant
              </button>

              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'FOUR_PIC_VIEW' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('FOUR_PIC_VIEW')}
              >
                Comparison
              </button>

              <button
                className={`checkpoint-tab-btn ${activeStageTab === 'VIEW_4WAY' ? 'active' : ''}`}
                onClick={() => setActiveStageTab('VIEW_4WAY')}
              >
                4-Way View
              </button>
            </div>

            {/* CTU / CU Size Desync Notice */}
            {hasDesync && activeStageTab !== 'MACRO' && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0.85rem',
                background: '#FEF3C7',
                border: '1.5px solid #D97706',
                marginBottom: '0.85rem',
                fontSize: '0.78rem',
                fontFamily: 'JetBrains Mono',
                color: '#92400E'
              }}>
                <span>
                  Analyzed CTU: ({analyzedCtu.x}, {analyzedCtu.y}) • Focused Target: CTU ({ctuX}, {ctuY}) (8×8)
                </span>
                <button
                  type="button"
                  onClick={() => handleUpload(null, ctuX, ctuY, 8, currentMode?.mode)}
                  disabled={loading}
                  style={{
                    padding: '0.25rem 0.75rem',
                    background: '#D97706',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '0.75rem'
                  }}
                >
                  {loading ? 'ANALYZING...' : `ANALYZE CTU (${ctuX}, {ctuY})`}
                </button>
              </div>
            )}

            {/* TAB CONTENT: Only renders the strictly selected active tab */}

            {/* TAB 1: FRAME OVERVIEW */}
            {activeStageTab === 'MACRO' && (
              <FullFrameViewer
                imageSrc={imagePreview}
                imageDims={imageDims}
                ctuX={ctuX}
                ctuY={ctuY}
                onSelectCTU={handleSelectCTU}
                onNavigateToQuadTree={(x, y) => {
                  handleSelectCTU(x, y);
                  setActiveStageTab('CP_01');
                }}
                partitionData={partitionData}
                ctuPartitionsMap={ctuPartitionsMap}
                isAnalyzed={true}
                onReAnalyze={(targetX, targetY) => {
                  handleUpload(null, targetX, targetY);
                }}
                loading={loading}
                selectedCu={selectedCu}
                onSelectCU={handleSelectCU}
              />
            )}

            {/* TAB 2: YUV PLANAR DECOMPOSITION */}
            {activeStageTab === 'YUV_VIEW' && (
              <YUVViewer
                imageSrc={imagePreview}
                imageDims={imageDims}
                ctuX={ctuX}
                ctuY={ctuY}
                onSelectCTU={handleSelectCTU}
                onNavigateToQuadTree={(x, y) => {
                  handleSelectCTU(x, y);
                  setActiveStageTab('CP_01');
                }}
                onNavigateToIntra={(x, y) => {
                  handleSelectCTU(x, y);
                  setActiveStageTab('INTRA_PIPE');
                }}
              />
            )}

            {/* TAB 3: QUADTREE PARTITIONING */}
            {activeStageTab === 'CP_01' && (
              <div className="stage-section-card">
                <div className="stage-section-header">
                  <div className="stage-section-title">
                    QuadTree Partitioning
                  </div>
                  <span className="stage-badge-tag">Stage 1</span>
                </div>
                <QuadTreeVisualizer
                  partitionData={partitionData}
                  ctuX={ctuX}
                  ctuY={ctuY}
                  imageSrc={imagePreview}
                  imageDims={imageDims}
                  selectedCU={selectedCu}
                  onSelectCU={handleSelectCU}
                  onNavigateToIntra={(node) => {
                    if (node && node.width !== 8) return; // Strict 8x8 limit
                    setSelectedCu(node);
                    const targetMode = (node && node.intra_dir !== null && node.intra_dir !== undefined) ? node.intra_dir : null;
                    if (targetMode !== null && data) {
                      const targetIdx = data.findIndex(d => d.mode === targetMode);
                      if (targetIdx !== -1) setCurrentModeIdx(targetIdx);
                    }
                    setActiveStageTab('INTRA_PIPE');
                  }}
                  onBackToFrame={() => setActiveStageTab('MACRO')}
                />
              </div>
            )}

            {/* TAB 4: INTRA PREDICTION PIPELINE */}
            {activeStageTab === 'INTRA_PIPE' && (
              <IntraPredictionFlow
                modeData={currentMode}
                refSamples={refSamples}
                currentMode={currentMode.mode}
                blockSize={8}
                imagePreview={imagePreview}
                imageDims={imageDims}
                ctuX={ctuX}
                ctuY={ctuY}
                onBackToQuadTree={() => setActiveStageTab('CP_01')}
                onGoTo4Way={() => setActiveStageTab('VIEW_4WAY')}
              />
            )}

            {/* TAB 5: TRANSFORM & QUANTIZATION */}
            {activeStageTab === 'CP_06_07' && (
              <div className="stage-section-card">
                <div className="stage-section-header">
                  <div className="stage-section-title">
                    Transform & Quantization
                  </div>
                  <span className="stage-badge-tag">Stage 4 & 5</span>
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

            {/* TAB 6: PICTURE COMPARISON (ORIGINAL, PREDICTION, RESIDUAL, RECONSTRUCTED) */}
            {activeStageTab === 'FOUR_PIC_VIEW' && (
              <FourPictureComparison
                imageSrc={imagePreview}
                imageDims={imageDims}
                ctuX={ctuX}
                ctuY={ctuY}
                currentMode={currentMode}
                selectedCu={selectedCu}
                jobId={jobId}
                API_BASE_URL={API_BASE_URL}
                onSelectCTU={handleSelectCTU}
                onNavigateToIntra={() => setActiveStageTab('INTRA_PIPE')}
              />
            )}

            {/* TAB 7: 4-WAY SYNCHRONIZED VIEWPORT */}
            {activeStageTab === 'VIEW_4WAY' && (
              <Synchronized4WayViewport
                modeData={currentMode}
                currentMode={currentMode.mode}
                blockSize={8}
                ctuX={ctuX}
                ctuY={ctuY}
                onBackToIntra={() => setActiveStageTab('INTRA_PIPE')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
