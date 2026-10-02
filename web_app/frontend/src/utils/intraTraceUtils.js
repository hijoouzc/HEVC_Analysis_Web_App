// Mathematical tracing of HEVC Intra Prediction reference samples
// Based on ITU-T H.265 / ISO/IEC 23008-2 specification

export const INTRA_PRED_ANGLES = {
  2: 32, 3: 26, 4: 21, 5: 17, 6: 13, 7: 9, 8: 5, 9: 2,
  10: 0,
  11: -2, 12: -5, 13: -9, 14: -13, 15: -17, 16: -21, 17: -26,
  18: -32,
  19: -26, 20: -21, 21: -17, 22: -13, 23: -9, 24: -5, 25: -2,
  26: 0,
  27: 2, 28: 5, 29: 9, 30: 13, 31: 17, 32: 21, 33: 26, 34: 32
};

export const INV_ANGLES = {
  '-2': 4096, '-5': 1638, '-9': 910, '-13': 630,
  '-17': 482, '-21': 390, '-26': 315, '-32': 256
};

/**
 * Traces the reference samples used to predict pixel (x, y) in a blockSize x blockSize CU
 * @param {number} mode Intra mode (0-34)
 * @param {number} x Column index (0..blockSize-1)
 * @param {number} y Row index (0..blockSize-1)
 * @param {number} blockSize Block size (8 for Luma, 4 for Chroma)
 * @param {number[]} refTop Reference samples top array
 * @param {number[]} refLeft Reference samples left array
 * @returns {object} { refs: Array<{type: 'top'|'left', index: number, weight: number}>, text: string }
 */
export function getPixelTrace(mode, x, y, blockSize = 8, rawRefTop = [], rawRefLeft = []) {
  const refTop = Array.isArray(rawRefTop) ? rawRefTop : [];
  const refLeft = Array.isArray(rawRefLeft) ? rawRefLeft : [];
  blockSize = Math.max(4, Number(blockSize ?? 8));
  const pCorner = refTop[0] ?? (refLeft[0] ?? 128);

  // Mode 0: Planar (Bilinear interpolation from 4 boundary points)
  if (mode === 0) {
    const wTop = (blockSize - 1 - y);
    const wLeft = (blockSize - 1 - x);
    const wBottomLeft = (y + 1);
    const wTopRight = (x + 1);

    const valTop = refTop[x + 1] ?? 128;
    const valLeft = refLeft[y + 1] ?? 128;
    const topRight = refTop[blockSize + 1] ?? (refTop[blockSize] ?? 128);
    const bottomLeft = refLeft[blockSize + 1] ?? (refLeft[blockSize] ?? 128);

    const horPred = wLeft * valLeft + wTopRight * topRight;
    const vertPred = wTop * valTop + wBottomLeft * bottomLeft;
    const planarVal = (horPred + vertPred + blockSize) >> (Math.log2(blockSize) + 1);

    return {
      modeType: 'planar',
      refs: [
        { type: 'top', index: x + 1, weight: wTop },
        { type: 'left', index: y + 1, weight: wLeft },
        { type: 'top', index: blockSize + 1, weight: wTopRight, isCorner: true },
        { type: 'left', index: blockSize + 1, weight: wBottomLeft, isCorner: true }
      ],
      text: `Mode 0 (Planar): ((${blockSize - 1}-${x})×${valLeft} + ${x + 1}×${topRight} + (${blockSize - 1}-${y})×${valTop} + ${y + 1}×${bottomLeft} + ${blockSize}) >> ${Math.log2(blockSize) + 1} = ${planarVal}`
    };
  }

  // Mode 1: DC (Average of boundary samples with boundary filtering)
  if (mode === 1) {
    let sumTop = 0;
    let sumLeft = 0;
    for (let i = 1; i <= blockSize; i++) {
      sumTop += (refTop[i] ?? 128);
      sumLeft += (refLeft[i] ?? 128);
    }
    const valDC = (sumTop + sumLeft + blockSize) >> (Math.log2(blockSize) + 1);

    const isTopBoundary = (y === 0 && x > 0);
    const isLeftBoundary = (x === 0 && y > 0);
    const isCorner = (x === 0 && y === 0);

    if (isCorner) {
      const top0 = refTop[1] ?? 128;
      const left0 = refLeft[1] ?? 128;
      const dcFilt = (left0 + 2 * valDC + top0 + 2) >> 2;
      return {
        modeType: 'dc',
        refs: [
          { type: 'top', index: 1, weight: 0.25 },
          { type: 'left', index: 1, weight: 0.25 }
        ],
        text: `Mode 1 (DC Filter [0,0]): (${left0} + 2×${valDC} + ${top0} + 2) >> 2 = ${dcFilt}`
      };
    } else if (isTopBoundary) {
      const topX = refTop[x + 1] ?? 128;
      const dcFilt = (topX + 3 * valDC + 2) >> 2;
      return {
        modeType: 'dc',
        refs: [{ type: 'top', index: x + 1, weight: 0.25 }],
        text: `Mode 1 (DC Filter Row 0): (${topX} + 3×${valDC} + 2) >> 2 = ${dcFilt}`
      };
    } else if (isLeftBoundary) {
      const leftY = refLeft[y + 1] ?? 128;
      const dcFilt = (leftY + 3 * valDC + 2) >> 2;
      return {
        modeType: 'dc',
        refs: [{ type: 'left', index: y + 1, weight: 0.25 }],
        text: `Mode 1 (DC Filter Col 0): (${leftY} + 3×${valDC} + 2) >> 2 = ${dcFilt}`
      };
    }

    return {
      modeType: 'dc-interior',
      refs: [
        { type: 'top', index: x + 1, weight: 0.5 },
        { type: 'left', index: y + 1, weight: 0.5 }
      ],
      text: `Mode 1 (DC Mean): (${sumTop} + ${sumLeft} + ${blockSize}) >> ${Math.log2(blockSize) + 1} = ${valDC}`
    };
  }

  // Vertical Angular Modes (18 to 34)
  if (mode >= 18 && mode <= 34) {
    if (mode === 26) {
      const pTop = refTop[x + 1] ?? 128;
      if (x === 0 && blockSize <= 16) {
        const pLeft = refLeft[y + 1] ?? 128;
        const grad = (pLeft - pCorner) >> 1;
        const val = Math.max(0, Math.min(255, pTop + grad));
        return {
          modeType: 'angular-exact',
          refs: [
            { type: 'top', index: 1, weight: 1.0 },
            { type: 'left', index: y + 1, weight: 0.5 },
            { type: 'top', index: 0, weight: 0.5 }
          ],
          text: `Mode 26 (Vertical + Edge Filter Col 0): p[0][-1] + ((p[-1][${y}] - p[-1][-1]) >> 1) = ${pTop} + ((${pLeft} - ${pCorner}) >> 1) = ${val}`
        };
      }
      return {
        modeType: 'angular-exact',
        refs: [{ type: 'top', index: x + 1, weight: 1.0 }],
        text: `Mode 26 (Vertical): p[${x}][-1] = ${pTop}`
      };
    }

    const angle = INTRA_PRED_ANGLES[mode] ?? 0;
    const delta = (y + 1) * angle;
    const deltaInt = delta >> 5;
    const deltaFract = delta & 31;
    const refIndex = x + 1 + deltaInt;

    if (refIndex >= 0) {
      if (deltaFract === 0) {
        const val = refTop[refIndex] ?? 128;
        return {
          modeType: 'angular-exact',
          refs: [{ type: 'top', index: refIndex, weight: 1.0 }],
          text: `Mode ${mode}: Top[${refIndex - 1}] = ${val}`
        };
      } else {
        const w1 = (32 - deltaFract) / 32;
        const w2 = deltaFract / 32;
        const val1 = refTop[refIndex] ?? 128;
        const val2 = refTop[refIndex + 1] ?? 128;
        const interpVal = Math.round(w1 * val1 + w2 * val2);
        return {
          modeType: 'angular-fractional',
          refs: [
            { type: 'top', index: refIndex, weight: w1 },
            { type: 'top', index: refIndex + 1, weight: w2 }
          ],
          text: `Mode ${mode}: (${32 - deltaFract}×${val1} + ${deltaFract}×${val2} + 16) >> 5 = ${interpVal}`
        };
      }
    } else {
      const invAngle = INV_ANGLES[angle] ?? 0;
      const leftIdx = Math.max(0, Math.min(blockSize * 2, (((-refIndex) * invAngle + 128) >> 8)));
      const val = refLeft[leftIdx] ?? 128;
      return {
        modeType: 'angular-left-ext',
        refs: [{ type: 'left', index: leftIdx, weight: 1.0 }],
        text: `Mode ${mode}: Ray → Left[${Math.max(0, leftIdx - 1)}] = ${val}`
      };
    }
  }

  // Horizontal Angular Modes (2 to 17)
  if (mode >= 2 && mode <= 17) {
    if (mode === 10) {
      const pLeft = refLeft[y + 1] ?? 128;
      if (y === 0 && blockSize <= 16) {
        const pTop = refTop[x + 1] ?? 128;
        const grad = (pTop - pCorner) >> 1;
        const val = Math.max(0, Math.min(255, pLeft + grad));
        return {
          modeType: 'angular-exact',
          refs: [
            { type: 'left', index: 1, weight: 1.0 },
            { type: 'top', index: x + 1, weight: 0.5 },
            { type: 'top', index: 0, weight: 0.5 }
          ],
          text: `Mode 10 (Horizontal + Edge Filter Row 0): p[-1][0] + ((p[${x}][-1] - p[-1][-1]) >> 1) = ${pLeft} + ((${pTop} - ${pCorner}) >> 1) = ${val}`
        };
      }
      return {
        modeType: 'angular-exact',
        refs: [{ type: 'left', index: y + 1, weight: 1.0 }],
        text: `Mode 10 (Horizontal): p[-1][${y}] = ${pLeft}`
      };
    }

    const angle = INTRA_PRED_ANGLES[mode] ?? 0;
    const delta = (x + 1) * angle;
    const deltaInt = delta >> 5;
    const deltaFract = delta & 31;
    const refIndex = y + 1 + deltaInt;

    if (refIndex >= 0) {
      if (deltaFract === 0) {
        const val = refLeft[refIndex] ?? 128;
        return {
          modeType: 'angular-exact',
          refs: [{ type: 'left', index: refIndex, weight: 1.0 }],
          text: `Mode ${mode}: Left[${refIndex - 1}] = ${val}`
        };
      } else {
        const w1 = (32 - deltaFract) / 32;
        const w2 = deltaFract / 32;
        const val1 = refLeft[refIndex] ?? 128;
        const val2 = refLeft[refIndex + 1] ?? 128;
        const interpVal = Math.round(w1 * val1 + w2 * val2);
        return {
          modeType: 'angular-fractional',
          refs: [
            { type: 'left', index: refIndex, weight: w1 },
            { type: 'left', index: refIndex + 1, weight: w2 }
          ],
          text: `Mode ${mode}: (${32 - deltaFract}×${val1} + ${deltaFract}×${val2} + 16) >> 5 = ${interpVal}`
        };
      }
    } else {
      const invAngle = INV_ANGLES[angle] ?? 0;
      const topIdx = Math.max(0, Math.min(blockSize * 2, (((-refIndex) * invAngle + 128) >> 8)));
      const val = refTop[topIdx] ?? 128;
      return {
        modeType: 'angular-top-ext',
        refs: [{ type: 'top', index: topIdx, weight: 1.0 }],
        text: `Mode ${mode}: Ray → Top[${Math.max(0, topIdx - 1)}] = ${val}`
      };
    }
  }

  return { refs: [], text: '' };
}

/**
 * Calculates animation stagger delay (in seconds) for a pixel based on the mode angle wavefront
 * @param {number} mode Intra mode (0-34)
 * @param {number} x Column index (0..blockSize-1)
 * @param {number} y Row index (0..blockSize-1)
 * @param {number} blockSize Block size (8 or 4)
 * @returns {number} Delay in seconds (0.0 to 0.18s)
 */
export function getWavefrontDelay(mode, x, y, blockSize = 8) {
  const safeBs = Math.max(2, Number(blockSize ?? 8));
  const denom = Math.max(1, safeBs - 1);
  let dist = 0;
  if (mode === 26) {
    // Pure vertical: top to bottom
    dist = y / denom;
  } else if (mode === 10) {
    // Pure horizontal: left to right
    dist = x / denom;
  } else if (mode >= 18 && mode <= 25) {
    // Negative vertical angles: top-left towards bottom-right
    dist = (y * 1.4 + x * 0.6) / (safeBs * 2);
  } else if (mode >= 27 && mode <= 34) {
    // Positive vertical angles: top-right towards bottom-left
    dist = (y * 1.4 + (safeBs - 1 - x) * 0.6) / (safeBs * 2);
  } else if (mode >= 2 && mode <= 9) {
    // Positive horizontal angles: bottom-left towards top-right
    dist = (x * 1.4 + (safeBs - 1 - y) * 0.6) / (safeBs * 2);
  } else if (mode >= 11 && mode <= 17) {
    // Negative horizontal angles: top-left towards bottom-right
    dist = (x * 1.4 + y * 0.6) / (safeBs * 2);
  } else if (mode === 0) {
    // Planar: radial sweep from top-left corner
    dist = Math.sqrt(x * x + y * y) / (Math.SQRT2 * denom);
  } else {
    // DC: expanding ripple from boundary inwards
    dist = Math.min(x, y, safeBs - 1 - x, safeBs - 1 - y) / (safeBs / 2);
  }

  return Math.max(0, Math.min(0.2, (Number.isFinite(dist) ? dist : 0) * 0.18));
}
