import React from 'react';
import { getResidualColorAndTextColor, SELECTION_HIGHLIGHT_COLOR } from '../../utils/colorUtils';

/**
 * ResidualMatrix
 * Displays the signed residual error matrix (Org - Pred = Resi)
 * with synchronized heatmap color coding and RD Cost readout.
 */
const ResidualMatrix = ({
  resiData,
  orgData,
  predData,
  N,
  cost,
  channel,
  stageGridSize,
  resiCellSize,
  showResiText,
  activeCoord,
  onCellClick
}) => {
  const containerDimension = stageGridSize ? `${stageGridSize}px` : '300px';

  return (
    <div className="live-matrix-card">
      <div className="live-matrix-header">
        <div className="live-matrix-header-info">
          <div className="live-matrix-title-wrap">
            <h3 className="live-matrix-title">RESIDUAL ({channel})</h3>
          </div>
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            fontFamily: 'JetBrains Mono',
            color: 'var(--c-magenta)',
            padding: '0.2rem 0.5rem',
            background: '#FFF0F5',
            border: '1px solid var(--c-magenta)',
            flexShrink: 0
          }}
        >
          COST: {cost !== undefined && cost !== null ? Number(cost).toFixed(1) : '0.0'}
        </div>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: containerDimension,
          height: containerDimension,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F9F9F9',
          border: '2px solid var(--c-black)',
          padding: '8px',
          boxSizing: 'border-box'
        }}
      >
        {/* N×N Residual Matrix Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${N}, ${resiCellSize}px)`,
            gridTemplateRows: `repeat(${N}, ${resiCellSize}px)`,
            gap: '1px',
            background: '#CBD5E1',
            border: '2px solid #0F172A',
            lineHeight: 1
          }}
        >
          {resiData.map((val, idx) => {
            const x = idx % N;
            const y = Math.floor(idx / N);
            const isSelected = activeCoord && activeCoord.x === x && activeCoord.y === y;
            const { bg, color } = getResidualColorAndTextColor(val, 64);

            return (
              <div
                key={`resi-live-${idx}`}
                className="cell"
                onClick={() => onCellClick && onCellClick({ x, y, val })}
                style={{
                  backgroundColor: bg,
                  color: color,
                  fontWeight: 700,
                  fontSize: resiCellSize >= 30 ? '0.70rem' : resiCellSize >= 20 ? '0.56rem' : '0.44rem',
                  fontFamily: 'JetBrains Mono',
                  cursor: 'pointer',
                  border: isSelected ? `2px solid ${SELECTION_HIGHLIGHT_COLOR}` : 'none',
                  boxShadow: 'none',
                  zIndex: isSelected ? 12 : 1,
                  transform: 'none',
                  transition: 'none',
                  letterSpacing: '-0.5px',
                  lineHeight: 1,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box'
                }}
                title={`Org(${orgData[idx]}) − Pred(${predData[idx]}) = Resi(${val})`}
              >
                {showResiText ? (val > 0 ? `+${val}` : val) : ''}
              </div>
            );
          })}
        </div>

        {/* Residual Legend */}
        <div style={{ display: 'flex', gap: '0.65rem', marginTop: '8px', fontSize: '0.68rem', fontFamily: 'JetBrains Mono', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: 8, height: 8, background: '#E11D48', display: 'inline-block' }} />
            <span>+ Under</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: 8, height: 8, background: '#0284C7', display: 'inline-block' }} />
            <span>− Over</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: 8, height: 8, background: '#F1F5F9', display: 'inline-block', border: '1px solid #CBD5E1' }} />
            <span>0 Exact</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ResidualMatrix);
