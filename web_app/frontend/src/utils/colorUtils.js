/**
 * Utility functions for precise YUV Chroma (Cb/Cr) color visualization
 */

/**
 * Returns accurate CSS background color and text color for a Chroma pixel value (0-255).
 * Neutral chroma is 128.
 * 
 * @param {number} val - 8-bit chroma sample value (0-255)
 * @param {boolean} isU - true for Cb (U), false for Cr (V)
 * @returns {{ bg: string, color: string }}
 */
export const getChromaColorAndTextColor = (val, isU) => {
  const diff = val - 128;

  if (isU) {
    // U (Cb): Blue to Cyan channel
    // Neutral 128 is mid-blue (Lightness ~56%)
    // Lower val (e.g. 115-124) -> Deeper navy/royal blue
    // Higher val (e.g. 126-138) -> Brighter sky-blue / cyan
    const lightness = Math.max(25, Math.min(88, 56 + diff * 2.3));
    const hue = Math.max(195, Math.min(225, 212 - diff * 1.0));
    const saturation = Math.max(55, Math.min(95, 75 + Math.abs(diff) * 0.5));
    const bg = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const color = lightness < 58 ? '#FFFFFF' : '#000000';
    return { bg, color };
  } else {
    // V (Cr): Crimson / Red to Soft Pink channel
    // Neutral 128 is soft rose (Lightness ~68%)
    // Higher val (e.g. 132-140) -> Richer, deeper crimson red
    // Lower val (e.g. 120-126) -> Paler, softer pastel pink
    const lightness = Math.max(26, Math.min(90, 68 - diff * 2.3));
    const hue = Math.max(342, Math.min(358, 350 - diff * 0.5));
    const saturation = Math.max(55, Math.min(90, 70 + Math.abs(diff) * 0.6));
    const bg = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const color = lightness < 58 ? '#FFFFFF' : '#000000';
    return { bg, color };
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

