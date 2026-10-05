import { describe, it, expect } from 'vitest';
import {
  COLOR_QR_ENABLED,
  COLOR_QR_PALETTE,
  classifyColor,
  classifyGrid,
  decodeColorCells,
  encodeColorCells,
  renderIdealPixels,
} from './colorQr.js';

const rng = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

describe('experimental color QR (NOT the pairing path)', () => {
  it('stays behind its flag and unwired', () => {
    expect(COLOR_QR_ENABLED).toBe(false);
  });

  it('packs 2 bits per cell: 4x fewer cells than bits', () => {
    const next = rng(42);
    const bytes = Uint8Array.from({ length: 200 }, () => Math.floor(next() * 256));
    const { cells, side } = encodeColorCells(bytes);
    expect(cells).toHaveLength(bytes.length * 4); // 800 cells vs 1600 bits in B&W
    expect(side * side).toBeGreaterThanOrEqual(cells.length);
    expect(decodeColorCells(cells, bytes.length)).toEqual(bytes);
  });

  it('round-trips through ideal pixels with a nearest-palette classifier', () => {
    const next = rng(7);
    const bytes = Uint8Array.from({ length: 64 }, () => Math.floor(next() * 256));
    const { cells, side } = encodeColorCells(bytes);
    const { data, width } = renderIdealPixels(cells, side);
    const found = classifyGrid(data, width, side).slice(0, cells.length);
    expect(decodeColorCells(found, bytes.length)).toEqual(bytes);
  });

  it('standard B&W decoders cannot read a color grid (a custom decoder would be mandatory)', async () => {
    const { default: jsQR } = await import('jsqr');
    const next = rng(7);
    const bytes = Uint8Array.from({ length: 64 }, () => Math.floor(next() * 256));
    const { cells, side } = encodeColorCells(bytes);
    const { data, width } = renderIdealPixels(cells, side);
    // jsQR thresholds to luminance and needs finder patterns: a raw color grid is unreadable to it.
    expect(jsQR(data, width, width)).toBeNull();
  });

  it('uneven illumination across the code flips cells (the realistic phone-camera failure)', () => {
    const next = rng(7);
    const bytes = Uint8Array.from({ length: 64 }, () => Math.floor(next() * 256));
    const { cells, side } = encodeColorCells(bytes);
    const { data, width } = renderIdealPixels(cells, side);
    // A shadow/falloff across the code (very common when the scanning phone
    // shades the screen): gain fades 1.0 -> 0.45 left to right. Dimmed white
    // then sits nearer to red, dimmed red nearer to black, and the nearest-
    // palette decision flips — with no per-device calibration to save it.
    const shaded = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const gain = 1.0 - 0.55 * (((i / 4) | 0) % width) / width;
      shaded[i] = data[i] * gain;
      shaded[i + 1] = data[i + 1] * gain;
      shaded[i + 2] = data[i + 2] * gain;
      shaded[i + 3] = 255;
    }
    const found = classifyGrid(shaded, width, side).slice(0, cells.length);
    let errors = 0;
    for (let i = 0; i < cells.length; i++) if (found[i] !== cells[i]) errors++;
    expect(errors).toBeGreaterThan(0);
    console.log(`color-QR uneven-illumination simulation: ${errors}/${cells.length} cells misclassified`);
  });

  it('documents the classifier palette', () => {
    expect(COLOR_QR_PALETTE).toHaveLength(4);
    expect(classifyColor(255, 255, 255)).toBe(0);
    expect(classifyColor(0, 0, 0)).toBe(1);
  });
});
