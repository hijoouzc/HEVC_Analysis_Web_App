import React from 'react';

/**
 * Renders the 4N+1 boundary reference samples framing an N×N prediction/original block.
 * Layout corresponds to HEVC perimeter within a (2N+1)×(2N+1) CSS grid:
 *  - Top-Left Corner: [-1, -1]
 *  - Direct Top: [0..N-1, -1]
 *  - Extended Top-Right: [N..2N-1, -1]
 *  - Direct Left: [-1, 0..N-1]
 *  - Extended Below-Left: [-1, N..2N-1]
 */
const ReferencePerimeter = ({
  refTop,
  refLeft,
  N,
  activeTopIndices,
  activeLeftIndices,
  showCellText,
  getRefStyle,
  prefix = 'ref'
}) => {
  const cornerVal = refTop[0] ?? 128;
  const isCornerActive = activeTopIndices.has(0) || activeLeftIndices.has(0);

  return (
    <>
      {/* Top-Left Corner Reference */}
      <div
        className="cell ref-cell"
        style={{
          gridColumn: 1,
          gridRow: 1,
          ...getRefStyle(cornerVal, isCornerActive, true, false)
        }}
        title={`Top-Left Reference [-1, -1] (Corner) = ${cornerVal}`}
      >
        {showCellText ? cornerVal : ''}
      </div>

      {/* Direct Top Samples [0..N-1] */}
      {refTop.slice(1, N + 1).map((val, idx) => {
        const topIdx = idx + 1;
        const isActive = activeTopIndices.has(topIdx);
        return (
          <div
            key={`${prefix}-top-${idx}`}
            className="cell ref-cell"
            style={{
              gridColumn: idx + 2,
              gridRow: 1,
              ...getRefStyle(val, isActive, false, false)
            }}
            title={`Top Reference [${idx}, -1] = ${val}`}
          >
            {showCellText ? val : ''}
          </div>
        );
      })}

      {/* Extended Top-Right Samples [N..2N-1] */}
      {refTop.slice(N + 1, 2 * N + 1).map((val, idx) => {
        const topIdx = idx + N + 1;
        const isActive = activeTopIndices.has(topIdx);
        return (
          <div
            key={`${prefix}-top-ext-${idx}`}
            className="cell ref-cell ref-extended"
            style={{
              gridColumn: idx + N + 2,
              gridRow: 1,
              ...getRefStyle(val, isActive, false, true)
            }}
            title={`Top-Right Ext Reference [${idx + N}, -1] = ${val}`}
          >
            {showCellText ? val : ''}
          </div>
        );
      })}

      {/* Direct Left Samples [0..N-1] */}
      {refLeft.slice(1, N + 1).map((val, idx) => {
        const leftIdx = idx + 1;
        const isActive = activeLeftIndices.has(leftIdx);
        return (
          <div
            key={`${prefix}-left-${idx}`}
            className="cell ref-cell"
            style={{
              gridColumn: 1,
              gridRow: idx + 2,
              ...getRefStyle(val, isActive, false, false)
            }}
            title={`Left Reference [-1, ${idx}] = ${val}`}
          >
            {showCellText ? val : ''}
          </div>
        );
      })}

      {/* Extended Below-Left Samples [N..2N-1] */}
      {refLeft.slice(N + 1, 2 * N + 1).map((val, idx) => {
        const leftIdx = idx + N + 1;
        const isActive = activeLeftIndices.has(leftIdx);
        return (
          <div
            key={`${prefix}-left-ext-${idx}`}
            className="cell ref-cell ref-extended"
            style={{
              gridColumn: 1,
              gridRow: idx + N + 2,
              ...getRefStyle(val, isActive, false, true)
            }}
            title={`Below-Left Ext Reference [-1, ${idx + N}] = ${val}`}
          >
            {showCellText ? val : ''}
          </div>
        );
      })}
    </>
  );
};

export default React.memo(ReferencePerimeter);
