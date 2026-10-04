// EXPERIMENTAL color-QR spike — NOT used by pairing. See the verdict below.
//
// Verdict: 4-color QR (2 bits per module) is NOT recommended as the primary
// join path. Theory promises 2x density, but practice breaks it:
//   - jsQR (our scanner) and every native phone camera app threshold to
//     black-and-white; a color code is unreadable without the app open AND a
//     custom decoder, killing the "point any camera at it" flow.
//   - Color classification is fragile across devices: auto white-balance and
//     exposure, OLED vs LCD gamut, Night Shift / True Tone, ambient-light tint
//     and viewing angle all shift the captured RGB. The test below shows a mild
//     white-balance shift already misclassifying cells.
//   - There is no maintained B&W-QR-compatible JS codec for HCC2D/JAB-style
//     color codes; we would own finder patterns, alignment, error correction
//     and a calibrated classifier — major decoder work for a halved module
//     count that still leaves a dense, awkward code.
//   - Accessibility: red/blue or low-saturation palettes fail contrast and
//     color-vision expectations; print vs screen inks differ further.
//
// This module exists only to pin the theory (2 bits/cell round-trip on ideal
// pixels) and demonstrate the failure mode (white-balance shift). It stays
// behind COLOR_QR_ENABLED = false and nothing imports it in production.

export const COLOR_QR_ENABLED = false;

// High-separation 4-color palette: white, black, red, blue (2 bits per cell).
export const COLOR_QR_PALETTE = [
  [255, 255, 255], // 0
  [0, 0, 0], // 1
  [214, 40, 40], // 2
  [37, 99, 235], // 3
];

/** Nearest-palette cell for an observed RGB triple (squared Euclidean). */
export function classifyColor(r, g, b) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < COLOR_QR_PALETTE.length; i++) {
    const [pr, pg, pb] = COLOR_QR_PALETTE[i];
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** Pack bytes into 2-bit cells (row-major); side is the smallest square that fits. */
export function encodeColorCells(bytes) {
  const cells = new Uint8Array(bytes.length * 4);
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    for (let k = 0; k < 4; k++) cells[i * 4 + k] = (byte >> (6 - k * 2)) & 3;
  }
  const side = Math.ceil(Math.sqrt(cells.length));
  return { cells, side };
}

/** Unpack cells produced by encodeColorCells back into bytes (needs the original byte length). */
export function decodeColorCells(cells, byteLength) {
  const out = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    let byte = 0;
    for (let k = 0; k < 4; k++) byte |= (cells[i * 4 + k] & 3) << (6 - k * 2);
    out[i] = byte;
  }
  return out;
}

/** Render cells to ideal RGB pixels (scale x scale per cell) — the lab case only, not a camera. */
export function renderIdealPixels(cells, side, scale = 4) {
  const width = side * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let i = 0; i < cells.length; i++) {
    const [pr, pg, pb] = COLOR_QR_PALETTE[cells[i]];
    const row = Math.floor(i / side);
    const col = i % side;
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const at = ((row * scale + dy) * width + col * scale + dx) * 4;
        data[at] = pr;
        data[at + 1] = pg;
        data[at + 2] = pb;
        data[at + 3] = 255;
      }
    }
  }
  return { data, width };
}

/** Classify every cell by sampling its centre pixel (ideal capture). */
export function classifyGrid(pixels, width, side, scale = 4) {
  const cells = new Uint8Array(side * side);
  for (let row = 0; row < side; row++) {
    for (let col = 0; col < side; col++) {
      const at = ((row * scale + Math.floor(scale / 2)) * width + col * scale + Math.floor(scale / 2)) * 4;
      cells[row * side + col] = classifyColor(pixels[at], pixels[at + 1], pixels[at + 2]);
    }
  }
  return cells;
}
