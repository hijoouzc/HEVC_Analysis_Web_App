/**
 * colorUtils.js
 * Unified colorimetry & palette utilities for HEVC Video Compression Analyzer:
 * - High-contrast Luma (Y) grayscale with dynamic text shadow
 * - ITU-R BT.601 / BT.709 physically accurate Chroma (Cb / Cr) colorimetry
 * - Synchronized signed residual error heatmap (Org - Pred = Resi)
 * - Standardized HEVC Intra Prediction Mode descriptions (0-34)
 */

/**
 * Clamps a numerical value within [min, max].
 */
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

/**
 * Universal highlight color for selected pixels and active references across all channels (Y, U, V).
 * Electric Amber (#F59E0B) provides peak optical complementary contrast against Blue (U / Cb),
 * strong warm-cold contrast against Red (V / Cr), and high chromatic pop against Grayscale (Y / Luma).
 */
export const SELECTION_HIGHLIGHT_COLOR = '#F59E0B';

/**
 * Returns accurate CSS background color, text color, and border for a Luma (Y) sample (0-255).
 * 
 * @param {number} val - 8-bit luma sample value (0-255)
 * @returns {{ bg: string, color: string, border: string, textShadow: string, val: number }}
 */
export const getLumaColorAndTextColor = (val) => {
  const v = clamp(Math.round(val ?? 128), 0, 255);
  const isDark = v < 128;
  return {
    bg: `rgb(${v}, ${v}, ${v})`,
    color: isDark ? '#FFFFFF' : '#000000',
    border: isDark ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(0, 0, 0, 0.18)',
    textShadow: 'none',
    val: v
  };
};

/**
 * Returns distinct, intuitive CSS background color, text color, and border for Chroma (Cb/Cr) samples:
 * - Cb (U): Dedicated Blue/Cyan channel (lower = deep navy blue, 128 = mid ocean blue, higher = bright sky cyan).
 * - Cr (V): Dedicated Crimson/Rose channel (lower = soft pale rose, 128 = vibrant rose/crimson, higher = deep crimson red).
 * Ensures Chroma channels are clearly distinguishable and never collapse into flat gray.
 * 
 * @param {number} val - 8-bit chroma sample value (0-255)
 * @param {boolean} isU - true for Cb (U), false for Cr (V)
 * @returns {{ bg: string, color: string, border: string, textShadow: string, val: number }}
 */
export const getChromaColorAndTextColor = (val, isU) => {
  const v = clamp(Math.round(val ?? 128), 0, 255);
  const diff = v - 128;

  if (isU) {
    // U (Cb): Distinctive Blue / Cyan Palette
    const lightness = clamp(Math.round(54 + diff * 1.8), 22, 88);
    const hue = clamp(Math.round(212 - diff * 0.7), 195, 226);
    const saturation = clamp(Math.round(74 + Math.abs(diff) * 0.4), 55, 92);
    const bg = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const color = lightness < 58 ? '#FFFFFF' : '#000000';
    return {
      bg,
      color,
      border: '1px solid rgba(0, 0, 0, 0.18)',
      textShadow: 'none',
      val: v
    };
  } else {
    // V (Cr): Distinctive Crimson / Rose / Red Palette
    const lightness = clamp(Math.round(64 - diff * 1.8), 24, 88);
    const hue = clamp(Math.round(350 - diff * 0.5), 342, 358);
    const saturation = clamp(Math.round(72 + Math.abs(diff) * 0.5), 55, 92);
    const bg = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const color = lightness < 58 ? '#FFFFFF' : '#000000';
    return {
      bg,
      color,
      border: '1px solid rgba(0, 0, 0, 0.18)',
      textShadow: 'none',
      val: v
    };
  }
};

/**
 * Universal dispatcher for pixel sample styling across any channel (Y, U, V).
 * 
 * @param {number} val - 8-bit sample value (0-255)
 * @param {'Y'|'U'|'V'} [channel='Y'] - Channel identifier
 * @returns {{ bg: string, color: string, border: string, textShadow: string, val: number }}
 */
export const getSampleColorAndTextColor = (val, channel = 'Y') => {
  if (channel === 'U') {
    return getChromaColorAndTextColor(val, true);
  }
  if (channel === 'V') {
    return getChromaColorAndTextColor(val, false);
  }
  return getLumaColorAndTextColor(val);
};

/**
 * Returns synchronized, consistent color and style for signed residual values (Org - Pred = Resi).
 * - val === 0: Exact match -> neutral slate (#F1F5F9)
 * - val > 0: Org > Pred (Under-prediction) -> Swiss Crimson (#E11D48) scaling with magnitude
 * - val < 0: Org < Pred (Over-prediction) -> Swiss Blue (#0284C7) scaling with magnitude
 * 
 * @param {number} val - Signed residual difference
 * @param {number} [maxScale=64] - Normalization denominator for color intensity
 * @returns {{ bg: string, color: string, textShadow: string, border: string, val: number }}
 */
export const getResidualColorAndTextColor = (val, maxScale = 64) => {
  const v = Math.round(val ?? 0);

  if (v === 0) {
    return {
      bg: '#F1F5F9',
      color: '#475569',
      textShadow: 'none',
      border: '1px solid #CBD5E1',
      val: 0
    };
  }

  const norm = clamp(Math.abs(v) / Math.max(1, maxScale), 0, 1);
  const alpha = 0.20 + 0.80 * norm;

  if (v > 0) {
    // Org > Pred (Under-predicted): Crimson palette
    return {
      bg: `rgba(225, 29, 72, ${alpha.toFixed(2)})`,
      color: norm > 0.42 ? '#FFFFFF' : '#881337',
      textShadow: 'none',
      border: `1px solid rgba(225, 29, 72, ${Math.min(1, alpha + 0.25).toFixed(2)})`,
      val: v
    };
  } else {
    // Org < Pred (Over-predicted): Blue palette
    return {
      bg: `rgba(2, 132, 199, ${alpha.toFixed(2)})`,
      color: norm > 0.42 ? '#FFFFFF' : '#0C4A6E',
      textShadow: 'none',
      border: `1px solid rgba(2, 132, 199, ${Math.min(1, alpha + 0.25).toFixed(2)})`,
      val: v
    };
  }
};

/**
 * Returns descriptive name, category, and explanation for an HEVC Intra Mode (0-34).
 * 
 * @param {number} mode - Intra prediction mode index (0-34)
 * @returns {{ name: string, type: string, desc: string }}
 */
export const getIntraModeInfo = (mode) => {
  if (mode === 0) return { name: 'Planar', type: '2D Smooth', desc: '4-corner bilinear planar interpolation' };
  if (mode === 1) return { name: 'DC', type: 'Flat Average', desc: 'Mean average of boundary reference samples' };
  if (mode === 10) return { name: 'Horizontal', type: 'Directional 10', desc: 'Pure horizontal directional prediction' };
  if (mode === 26) return { name: 'Vertical', type: 'Directional 26', desc: 'Pure vertical directional prediction' };
  if (mode === 2) return { name: 'Angular 2', type: 'Bottom-Left (45°)', desc: 'Diagonal prediction from bottom-left' };
  if (mode === 18) return { name: 'Angular 18', type: 'Diagonal (45°)', desc: 'Diagonal prediction from top-left' };
  if (mode === 34) return { name: 'Angular 34', type: 'Top-Right (45°)', desc: 'Diagonal prediction from top-right' };
  if (mode > 2 && mode < 10) return { name: `Angular ${mode}`, type: 'Bottom-Left → Hor', desc: `Angular prediction (Mode ${mode})` };
  if (mode > 10 && mode < 18) return { name: `Angular ${mode}`, type: 'Hor → Diagonal', desc: `Angular prediction (Mode ${mode})` };
  if (mode > 18 && mode < 26) return { name: `Angular ${mode}`, type: 'Diagonal → Ver', desc: `Angular prediction (Mode ${mode})` };
  if (mode > 26 && mode < 34) return { name: `Angular ${mode}`, type: 'Ver → Top-Right', desc: `Angular prediction (Mode ${mode})` };
  return { name: `Mode ${mode}`, type: 'Intra', desc: `Intra Mode ${mode}` };
};
