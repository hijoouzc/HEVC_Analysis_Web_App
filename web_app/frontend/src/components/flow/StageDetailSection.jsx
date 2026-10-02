import React from 'react';
import { getResidualColorAndTextColor } from '../../utils/colorUtils';

/**
 * StageDetailSection
 * Comprehensive architectural drilldown for Stages 01 to 04 of the HEVC Intra Pipeline:
 *  - Stage 01: Boundary Sample Prep & Availability
 *  - Stage 02: Reference Substitution & MDIS Smoothing
 *  - Stage 03: Directional / Planar / DC Prediction Math
 *  - Stage 04: Boundary Filtering & Residual Matrix Generation
 */
const StageDetailSection = ({
  activeTab,
  channel,
  selectedMode,
  modeInfo,
  N,
  _totalPixels,
  ctuX,
  ctuY,
  imagePreview,
  refTopRaw,
  refLeftRaw,
  refTopActive,
  isMDISSmoothed,
  hasEdgeFilter,
  angle,
  _invAngle,
  orgData,
  predData,
  resiData,
  modeData,
  getSampleColor
}) => {
  if (activeTab === 'all') return null;

  return (
    <>
      {/* VIEW 2: STAGE 01 DETAIL */}
      {activeTab === 'step1' && (
        <div className="stage-detail-box">
          <div className="stage-detail-header">
            <span className="stage-tag">STAGE 01 DETAIL</span>
            <h3 className="stage-title">Reference Sample Preparation & Boundary Fetching ({channel})</h3>
          </div>

          <div className="stage-io-row">
            {/* INPUT CARD */}
            <div className="stage-io-col">
              <span className="io-col-badge">INPUT DATA</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Coordinates:</strong> CTU [{ctuX}, {ctuY}]</div>
                <div className="io-meta-line"><strong>Channel:</strong> {channel === 'Y' ? 'Luma Y' : channel === 'U' ? 'Chroma Cb' : 'Chroma Cr'} [{N}×{N}]</div>

                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  {imagePreview ? (
                    <div style={{ position: 'relative', width: '220px', height: '140px', overflow: 'hidden', border: '2px solid #000' }}>
                      <img src={imagePreview} alt="Reconstructed Frame" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div
                        style={{
                          position: 'absolute',
                          left: '30%',
                          top: '30%',
                          width: '40px',
                          height: '40px',
                          border: '2px solid #FFD200',
                          background: 'rgba(255, 210, 0, 0.25)'
                        }}
                      />
                    </div>
                  ) : <div>No Image Available</div>}
                </div>
              </div>
            </div>

            {/* PROCESS CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
            </div>

            <div className="stage-io-col" style={{ flex: 1.2 }}>
              <span className="io-col-badge" style={{ background: '#000', color: '#FFF' }}>BOUNDARY EXTRACTION</span>
              <div className="stage-io-card" style={{ background: '#FFF' }}>
                <div className="math-display" style={{ fontSize: '0.78rem' }}>
                  <div className="math-row">
                    <span className="math-lhs">Top Samples:</span>
                    <span className="math-rhs">p[x][-1] = Reco[xCU + x, yCU - 1], &nbsp; x ∈ [-1, 2N-1]</span>
                  </div>
                  <div className="math-row">
                    <span className="math-lhs">Left Samples:</span>
                    <span className="math-rhs">p[-1][y] = Reco[xCU - 1, yCU + y], &nbsp; y ∈ [0, 2N-1]</span>
                  </div>
                </div>

                <div style={{ marginTop: '10px', fontSize: '0.74rem', color: '#333', lineHeight: 1.4 }}>
                  • Gathers 1 Top-Left + 2N ({2 * N}) Above + 2N ({2 * N}) Left = <strong>4N + 1 ({4 * N + 1} samples)</strong> for {channel} channel.
                </div>
              </div>
            </div>

            {/* OUTPUT CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
            </div>

            <div className="stage-io-col">
              <span className="io-col-badge" style={{ background: 'var(--c-green)', color: '#000' }}>OUTPUT DATA</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Sample Count:</strong> {4 * N + 1} Raw Perimeter Samples</div>

                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: '4px' }}>Top Row ({2 * N + 1} Pels):</div>
                  <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap', maxWidth: '220px', background: '#CBD5E1', padding: '1px', border: '1px solid #94A3B8' }}>
                    {refTopRaw.slice(0, Math.min(33, 2 * N + 1)).map((v, i) => {
                      const { bg, color, border } = getSampleColor(v);
                      return (
                        <div key={i} style={{ width: 12, height: 16, background: bg, color: color, border: border || '1px solid rgba(0,0,0,0.18)', fontSize: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {v}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, marginTop: '6px', marginBottom: '4px' }}>Left Col ({2 * N + 1} Pels):</div>
                  <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap', maxWidth: '220px', background: '#CBD5E1', padding: '1px', border: '1px solid #94A3B8' }}>
                    {refLeftRaw.slice(0, Math.min(33, 2 * N + 1)).map((v, i) => {
                      const { bg, color, border } = getSampleColor(v);
                      return (
                        <div key={i} style={{ width: 12, height: 16, background: bg, color: color, border: border || '1px solid rgba(0,0,0,0.18)', fontSize: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {v}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: STAGE 02 DETAIL */}
      {activeTab === 'step2' && (
        <div className="stage-detail-box">
          <div className="stage-detail-header">
            <span className="stage-tag">STAGE 02 DETAIL</span>
            <h3 className="stage-title">Reference Substitution & Mode-Dependent Smoothing (MDIS)</h3>
          </div>

          <div className="stage-io-row">
            {/* INPUT CARD */}
            <div className="stage-io-col">
              <span className="io-col-badge">INPUT: RAW REFS</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Mode:</strong> Mode {selectedMode} ({modeInfo.name})</div>
                <div className="io-meta-line"><strong>Filter:</strong> {isMDISSmoothed ? '3-Tap Smoothing' : 'Direct Bypass'}</div>

                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>Raw Top Reference:</div>
                  <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap', maxWidth: '220px', background: '#CBD5E1', padding: '1px', border: '1px solid #94A3B8' }}>
                    {refTopRaw.slice(0, Math.min(33, 2 * N + 1)).map((v, i) => {
                      const { bg, color, border } = getSampleColor(v);
                      return (
                        <div key={i} style={{ width: 12, height: 16, background: bg, color: color, border: border || '1px solid rgba(0,0,0,0.18)', fontSize: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {v}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* PROCESS CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
            </div>

            <div className="stage-io-col" style={{ flex: 1.2 }}>
              <span className="io-col-badge" style={{ background: '#000', color: '#FFF' }}>SMOOTHING PROCESS</span>
              <div className="stage-io-card" style={{ background: '#FFF' }}>
                <div className="formula-badge">3-Tap Smoothing Kernel [1, 2, 1] / 4</div>
                <div className="math-display" style={{ fontSize: '0.78rem' }}>
                  <div className="math-row">
                    <span className="math-lhs">Top Filter:</span>
                    <span className="math-rhs">p'[x][-1] = (p[x-1][-1] + 2·p[x][-1] + p[x+1][-1] + 2) &gt;&gt; 2</span>
                  </div>
                  <div className="math-row">
                    <span className="math-lhs">Left Filter:</span>
                    <span className="math-rhs">p'[-1][y] = (p[-1][y-1] + 2·p[-1][y] + p[-1][y+1] + 2) &gt;&gt; 2</span>
                  </div>
                </div>

                <div style={{ marginTop: '10px', fontSize: '0.74rem', color: '#333', lineHeight: 1.4 }}>
                  • <strong>MDIS Criteria (Luma):</strong> Selected diagonal modes activate the 3-tap filter to eliminate high-frequency perimeter noise.
                </div>
              </div>
            </div>

            {/* OUTPUT CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
            </div>

            <div className="stage-io-col">
              <span className="io-col-badge" style={{ background: 'var(--c-blue)', color: '#FFF' }}>OUTPUT: CLEAN REFS</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Status:</strong> {isMDISSmoothed ? 'Smoothed' : 'Direct Pass-through'}</div>
                <div className="io-meta-line"><strong>Samples:</strong> {4 * N + 1} Perimeter Samples</div>

                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>Effective Top Reference:</div>
                  <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap', maxWidth: '220px', background: '#CBD5E1', padding: '1px', border: '1px solid #94A3B8' }}>
                    {refTopActive.slice(0, Math.min(33, 2 * N + 1)).map((v, i) => {
                      const { bg, color, border } = getSampleColor(v);
                      return (
                        <div key={i} style={{ width: 12, height: 16, background: bg, color: color, border: border || '1px solid rgba(0,0,0,0.18)', fontSize: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {v}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: STAGE 03 DETAIL */}
      {activeTab === 'step3' && (
        <div className="stage-detail-box">
          <div className="stage-detail-header">
            <span className="stage-tag">STAGE 03 DETAIL</span>
            <h3 className="stage-title">Sample Prediction: Planar / DC / 33 Directional Angles</h3>
          </div>

          <div className="stage-io-row">
            {/* INPUT CARD */}
            <div className="stage-io-col">
              <span className="io-col-badge">INPUT: REFS & PARAMS</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Mode:</strong> Mode {selectedMode} ({modeInfo.name})</div>
                <div className="io-meta-line"><strong>Angle Displacement:</strong> {angle} (1/32 sub-pel)</div>

                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>Perimeter Buffer:</div>
                  <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap', maxWidth: '220px', background: '#CBD5E1', padding: '1px', border: '1px solid #94A3B8' }}>
                    {refTopActive.slice(0, Math.min(10, 2 * N + 1)).map((v, i) => {
                      const { bg, color, border } = getSampleColor(v);
                      return (
                        <div key={i} style={{ width: 18, height: 18, background: bg, color: color, border: border || '1px solid rgba(0,0,0,0.18)', fontSize: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {v}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* PROCESS CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
            </div>

            <div className="stage-io-col" style={{ flex: 1.2 }}>
              <span className="io-col-badge" style={{ background: '#000', color: '#FFF' }}>HM C++ PROCESS & FORMULA</span>
              <div className="stage-io-card" style={{ background: '#FFF' }}>
                <div className="formula-badge">Mathematical Prediction for Mode {selectedMode} (N={N})</div>
                {selectedMode === 0 ? (
                  <div className="math-display" style={{ fontSize: '0.78rem' }}>
                    <div className="math-row">
                      <span className="math-lhs">p_h =</span>
                      <span className="math-rhs">({N} - 1 - x)·p[-1][y] + (x + 1)·p[{N}][-1]</span>
                    </div>
                    <div className="math-row">
                      <span className="math-lhs">p_v =</span>
                      <span className="math-rhs">({N} - 1 - y)·p[x][-1] + (y + 1)·p[-1][{N}]</span>
                    </div>
                    <div className="math-row">
                      <span className="math-lhs">pred[x, y] =</span>
                      <span className="math-rhs">(p_h + p_v + {N}) &gt;&gt; ({Math.round(Math.log2(N)) + 1})</span>
                    </div>
                  </div>
                ) : selectedMode === 1 ? (
                  <div className="math-display" style={{ fontSize: '0.78rem' }}>
                    <div className="math-row">
                      <span className="math-lhs">dcVal =</span>
                      <span className="math-rhs">[ ∑ p[x'][-1] + ∑ p[-1][y'] + {N} ] &gt;&gt; ({Math.round(Math.log2(N)) + 1})</span>
                    </div>
                    <div className="math-row">
                      <span className="math-lhs">pred[x, y] =</span>
                      <span className="math-rhs">dcVal &nbsp; (Uniform Flat Average)</span>
                    </div>
                  </div>
                ) : (
                  <div className="math-display" style={{ fontSize: '0.78rem' }}>
                    <div className="math-row">
                      <span className="math-lhs">deltaPos =</span>
                      <span className="math-rhs">(y + 1) · {angle}</span>
                    </div>
                    <div className="math-row">
                      <span className="math-lhs">iIdx =</span>
                      <span className="math-rhs">deltaPos &gt;&gt; 5, &nbsp; iFact = deltaPos &amp; 31</span>
                    </div>
                    <div className="math-row">
                      <span className="math-lhs">pred[x, y] =</span>
                      <span className="math-rhs">
                        iFact ≠ 0 ? [ (32 - iFact)·ref[x+iIdx+1] + iFact·ref[x+iIdx+2] + 16 ] &gt;&gt; 5 : ref[x+iIdx+1]
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* OUTPUT CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
              <span className="process-label">{N}×{N}</span>
            </div>

            <div className="stage-io-col">
              <span className="io-col-badge" style={{ background: 'var(--c-blue)', color: '#FFF' }}>PRED BLOCK</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Dimensions:</strong> {N} × {N}</div>
                <div className="io-meta-line"><strong>Mode:</strong> {modeInfo.name}</div>

                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${N}, ${Math.max(4, Math.floor(160 / N))}px)`,
                    gridTemplateRows: `repeat(${N}, ${Math.max(4, Math.floor(160 / N))}px)`,
                    gap: '1px',
                    background: '#CBD5E1',
                    border: '1.5px solid #0F172A'
                  }}>
                    {predData.map((v, i) => {
                      const { bg, color, border } = getSampleColor(v);
                      return (
                        <div key={i} style={{ backgroundColor: bg, color: color, border: border || 'none', fontSize: N <= 8 ? '0.45rem' : '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {N <= 8 ? v : ''}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: STAGE 04 DETAIL */}
      {activeTab === 'step4' && (
        <div className="stage-detail-box">
          <div className="stage-detail-header">
            <span className="stage-tag">Stage 04</span>
            <h3 className="stage-title">Boundary Filtering & Residual Generation ({channel})</h3>
          </div>

          <div className="stage-io-row">
            {/* INPUT CARD */}
            <div className="stage-io-col">
              <span className="io-col-badge">INPUT</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Dimensions:</strong> {N} × {N}</div>
                <div className="io-meta-line"><strong>Edge Filter:</strong> {hasEdgeFilter ? 'Active' : 'Bypass'}</div>

                <div className="io-visual-box" style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700 }}>Original:</div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${N}, ${Math.max(3, Math.floor(96 / N))}px)`,
                      gridTemplateRows: `repeat(${N}, ${Math.max(3, Math.floor(96 / N))}px)`,
                      gap: '1px',
                      background: '#CBD5E1',
                      border: '1px solid #0F172A'
                    }}>
                      {orgData.map((v, i) => {
                        const { bg, border } = getSampleColor(v);
                        return <div key={i} style={{ backgroundColor: bg, border: border || 'none' }} />;
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700 }}>Prediction:</div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${N}, ${Math.max(3, Math.floor(96 / N))}px)`,
                      gridTemplateRows: `repeat(${N}, ${Math.max(3, Math.floor(96 / N))}px)`,
                      gap: '1px',
                      background: '#CBD5E1',
                      border: '1px solid #0F172A'
                    }}>
                      {predData.map((v, i) => {
                        const { bg, border } = getSampleColor(v);
                        return <div key={i} style={{ backgroundColor: bg, border: border || 'none' }} />;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PROCESS CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
              <span className="process-label">Org − Pred</span>
            </div>

            <div className="stage-io-col" style={{ flex: 1.2 }}>
              <span className="io-col-badge" style={{ background: '#000', color: '#FFF' }}>PROCESS & FORMULA</span>
              <div className="stage-io-card" style={{ background: '#FFF' }}>
                <div className="formula-badge">Boundary Smoothing & Residual Subtraction</div>
                <div className="math-display" style={{ fontSize: '0.78rem' }}>
                  <div className="math-row">
                    <span className="math-lhs">Residual Matrix:</span>
                    <span className="math-rhs">resi[x, y] = org[x, y] - pred[x, y]</span>
                  </div>
                  {selectedMode === 1 && hasEdgeFilter && (
                    <div className="math-row">
                      <span className="math-lhs">DC Corner Filter:</span>
                      <span className="math-rhs">pred[0,0] = (p[0,-1] + p[-1,0] + 2·dcVal + 2) &gt;&gt; 2</span>
                    </div>
                  )}
                  {selectedMode === 26 && hasEdgeFilter && (
                    <div className="math-row">
                      <span className="math-lhs">Ver Edge Filter:</span>
                      <span className="math-rhs">pred[0,y] = Clip3(0, 255, pred[0,y] + ((p[-1,y] - p[-1,-1]) &gt;&gt; 1))</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* OUTPUT CARD */}
            <div className="stage-io-arrow-col">
              <div className="stage-io-arrow">→</div>
              <span className="process-label">{N}×{N}</span>
            </div>

            <div className="stage-io-col">
              <span className="io-col-badge" style={{ background: 'var(--c-magenta)', color: '#FFF' }}>RESIDUAL</span>
              <div className="stage-io-card">
                <div className="io-meta-line"><strong>Dimensions:</strong> {N} × {N}</div>
                <div className="io-meta-line"><strong>RDO Cost:</strong> {modeData?.cost !== undefined ? Number(modeData.cost).toFixed(1) : '0.0'}</div>

                <div className="io-visual-box" style={{ marginTop: '10px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${N}, ${Math.max(4, Math.floor(160 / N))}px)`,
                    gridTemplateRows: `repeat(${N}, ${Math.max(4, Math.floor(160 / N))}px)`,
                    gap: '1px',
                    background: '#CBD5E1',
                    border: '1.5px solid #0F172A'
                  }}>
                    {resiData.map((v, i) => {
                      const resStyle = getResidualColorAndTextColor(v, 64);
                      return (
                        <div
                          key={i}
                          style={{
                            backgroundColor: resStyle.bg,
                            color: resStyle.color,
                            border: resStyle.border,
                            fontSize: N <= 8 ? '0.45rem' : '0.35rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {N <= 8 ? (v > 0 ? `+${v}` : v) : ''}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(StageDetailSection);
