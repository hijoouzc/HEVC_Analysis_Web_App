import React from 'react';
import AngularCompass from '../AngularCompass';
import { getIntraModeInfo } from '../../utils/colorUtils';

/**
 * AnalysisSidebar
 * Clean, Apple-inspired left sidebar controller:
 *  - Target CTU Context & Quick Navigation
 *  - Intra Mode Controller (stepper, auto-play, dropdown, 360° compass)
 *  - Block Information & Metrics
 */
const AnalysisSidebar = ({
  ctuX,
  ctuY,
  activeStageTab,
  onNavigateTab,
  ctuPartitionsMap,
  setPartitionData,
  data,
  currentModeIdx,
  setCurrentModeIdx,
  isPlaying,
  setIsPlaying,
  currentMode,
  currentModeInfo,
  selectedCu,
  analyzedCuSize
}) => {
  const navTabs = [
    { id: 'MACRO', label: 'Frame' },
    { id: 'YUV_VIEW', label: 'YUV Planes' },
    { id: 'CP_01', label: 'QuadTree' },
    { id: 'INTRA_PIPE', label: 'Intra Prediction' },
    { id: 'CP_06_07', label: 'Transform & Quant' },
    { id: 'FOUR_PIC_VIEW', label: 'Comparison' },
    { id: 'VIEW_4WAY', label: '4-Way View' },
  ];

  return (
    <div className="workspace-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Panel 1: Target CTU Context */}
      <div className="sidebar-panel" style={{ padding: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Target CTU</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0284C7' }}>
            {ctuX !== null && ctuY !== null ? `(${ctuX}, ${ctuY})` : 'None'}
          </span>
        </div>

        {/* Clean Navigation List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navTabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === 'CP_01' && ctuX !== null && ctuY !== null) {
                  const cached = ctuPartitionsMap[`${ctuX}_${ctuY}`];
                  if (cached) setPartitionData(cached);
                }
                onNavigateTab(tab.id);
              }}
              style={{
                width: '100%',
                background: activeStageTab === tab.id ? 'var(--c-black)' : 'var(--c-white)',
                color: activeStageTab === tab.id ? 'var(--c-white)' : 'var(--c-black)',
                padding: '0.35rem 0.6rem',
                border: '1px solid #CBD5E1',
                fontWeight: 600,
                fontSize: '0.74rem',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel 2: Intra Mode Stepper & Controller */}
      <div className="sidebar-panel" style={{ padding: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Intra Mode</span>
        </div>

        {/* Stepper Buttons */}
        <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.6rem' }}>
          <button
            className="control-btn"
            onClick={() => setCurrentModeIdx(Math.max(0, currentModeIdx - 1))}
            disabled={currentModeIdx === 0}
            title="Previous Mode (←)"
            style={{ flex: 1, padding: '0.35rem' }}
          >
            ←
          </button>
          <button
            className="control-btn play-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause" : "Auto Play"}
            style={{ flex: 1, padding: '0.35rem' }}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <button
            className="control-btn"
            onClick={() => setCurrentModeIdx(Math.min((data?.length || 1) - 1, currentModeIdx + 1))}
            disabled={!data || currentModeIdx === data.length - 1}
            title="Next Mode (→)"
            style={{ flex: 1, padding: '0.35rem' }}
          >
            →
          </button>
        </div>

        {/* Mode Dropdown */}
        <select
          value={currentModeIdx}
          onChange={e => setCurrentModeIdx(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '0.35rem',
            border: '1px solid #CBD5E1',
            fontFamily: 'JetBrains Mono',
            fontSize: '0.72rem',
            marginBottom: '0.6rem',
            background: 'var(--c-white)'
          }}
        >
          {data?.map((item, idx) => {
            const info = getIntraModeInfo(item.mode);
            return (
              <option key={idx} value={idx}>
                Mode {item.mode}: {info.name} — Cost: {typeof item.cost === 'number' ? item.cost.toFixed(1) : (item.cost ?? '—')}
              </option>
            );
          })}
        </select>

        {/* Angular Compass */}
        {currentMode && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.6rem' }}>
            <AngularCompass
              currentMode={currentMode.mode}
              onSelectMode={(targetMode) => {
                const targetIdx = data.findIndex(d => d.mode === targetMode);
                if (targetIdx !== -1) setCurrentModeIdx(targetIdx);
              }}
            />
          </div>
        )}

        {/* Mode Info Badge */}
        {currentMode && (
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            padding: '0.45rem',
            fontSize: '0.74rem'
          }}>
            <div><strong>Mode {currentMode.mode}</strong>: {currentModeInfo?.name}</div>
            <div style={{ color: '#64748B', marginTop: '0.15rem' }}>
              RD Cost: <strong style={{ color: '#D97706' }}>{typeof currentMode.cost === 'number' ? currentMode.cost.toFixed(2) : (currentMode.cost ?? '—')}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Panel 3: Block Information */}
      <div className="sidebar-panel" style={{ padding: '0.85rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Block Information
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.72rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748B' }}>Target CU:</span>
            <strong>{selectedCu ? `${selectedCu.width}×${selectedCu.height}` : `${analyzedCuSize}×${analyzedCuSize}`} {selectedCu?.depth !== undefined ? `(D${selectedCu.depth})` : ''}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748B' }}>Depth:</span>
            <strong>{selectedCu?.depth ?? 0}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AnalysisSidebar);
