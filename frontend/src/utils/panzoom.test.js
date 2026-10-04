import { describe, it, expect } from 'vitest';
import {
  clamp,
  fitScale,
  clampAxis,
  clampView,
  toContent,
  zoomAbout,
  pinchView,
  centerOn,
  cellAt,
  lerpView,
  distance,
  midpoint,
} from './panzoom.js';

// The board as the phone lays it out: 15 cells of 40px = 600px square; a 300px square viewport throughout.
const CONTENT = { width: 600, height: 600 };
const VIEWPORT = { width: 300, height: 300 };

describe('clamp', () => {
  it('limits to the range and passes values inside it', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('fitScale', () => {
  it('is viewport width / content width', () => {
    expect(fitScale(600, 300)).toBe(0.5);
    expect(fitScale(600, 360)).toBe(0.6);
    expect(fitScale(400, 800)).toBe(2);
  });

  it('falls back to 1 for a zero or missing size (e.g. before layout)', () => {
    expect(fitScale(0, 300)).toBe(1);
    expect(fitScale(600, 0)).toBe(1);
    expect(fitScale(undefined, 300)).toBe(1);
  });
});

describe('clampAxis', () => {
  it('content that exactly fills the viewport sits at 0 whatever the requested offset', () => {
    // 600 * 0.5 = 300 = viewport
    expect(clampAxis(50, 600, 0.5, 300)).toBe(0);
    expect(clampAxis(-50, 600, 0.5, 300)).toBe(0);
  });

  it('content smaller than the viewport is centred', () => {
    // 600 * 0.25 = 150, (300 - 150) / 2 = 75
    expect(clampAxis(0, 600, 0.25, 300)).toBe(75);
    expect(clampAxis(-999, 600, 0.25, 300)).toBe(75);
  });

  it('content larger than the viewport must cover it: offset in [300 - 600, 0]', () => {
    expect(clampAxis(10, 600, 1, 300)).toBe(0);
    expect(clampAxis(-400, 600, 1, 300)).toBe(-300);
    expect(clampAxis(-120, 600, 1, 300)).toBe(-120);
  });
});

describe('clampView', () => {
  it('clamps the scale first, then each axis for that scale', () => {
    // scale 5 -> 1.5, content 900px: x in [-600, 0]
    expect(clampView({ scale: 5, x: 0, y: -2000 }, CONTENT, VIEWPORT, 0.5, 1.5)).toEqual({ scale: 1.5, x: 0, y: -600 });
  });

  it('a scale below the minimum is raised to it and the board snaps to fill the viewport', () => {
    expect(clampView({ scale: 0.1, x: 40, y: -40 }, CONTENT, VIEWPORT, 0.5, 1.5)).toEqual({ scale: 0.5, x: 0, y: 0 });
  });

  it('handles a viewport that is wider than tall (vertical panning at fit-to-width)', () => {
    // fit to width 600 -> 300: scale 0.5, content height 300 > viewport height 200, y in [-100, 0]
    const wide = { width: 300, height: 200 };
    expect(clampView({ scale: 0.5, x: 0, y: -150 }, CONTENT, wide, 0.5, 2)).toEqual({ scale: 0.5, x: 0, y: -100 });
    expect(clampView({ scale: 0.5, x: 0, y: -60 }, CONTENT, wide, 0.5, 2)).toEqual({ scale: 0.5, x: 0, y: -60 });
  });
});

describe('toContent', () => {
  it('inverts the transform', () => {
    // ((100 + 100) / 2, (150 + 50) / 2)
    expect(toContent({ scale: 2, x: -100, y: -50 }, { x: 100, y: 150 })).toEqual({ x: 100, y: 100 });
    expect(toContent({ scale: 0.5, x: 0, y: 0 }, { x: 150, y: 30 })).toEqual({ x: 300, y: 60 });
  });
});

describe('zoomAbout', () => {
  it('doubling about (100, 50) from the identity keeps that point still', () => {
    const view = zoomAbout({ scale: 1, x: 0, y: 0 }, 2, { x: 100, y: 50 });
    // x = 100 - 100 * 2, y = 50 - 50 * 2
    expect(view).toEqual({ scale: 2, x: -100, y: -50 });
    expect(toContent(view, { x: 100, y: 50 })).toEqual({ x: 100, y: 50 });
  });

  it('halving about (60, 80) from a panned view', () => {
    // ratio 0.5: x = 60 - (60 + 100) * 0.5 = -20, y = 80 - (80 + 40) * 0.5 = 20
    const before = { scale: 2, x: -100, y: -40 };
    const view = zoomAbout(before, 1, { x: 60, y: 80 });
    expect(view).toEqual({ scale: 1, x: -20, y: 20 });
    expect(toContent(view, { x: 60, y: 80 })).toEqual(toContent(before, { x: 60, y: 80 }));
  });
});

describe('pinchView', () => {
  const start = { scale: 1, x: 0, y: 0 };
  const focal = { x: 100, y: 100 };

  it('spreading the fingers to twice the distance doubles the scale about the midpoint', () => {
    // anchor (100, 100), scale 2: x = 100 - 200 = -100
    expect(pinchView(start, focal, 100, focal, 200, 0.5, 3)).toEqual({ scale: 2, x: -100, y: -100 });
  });

  it('moving the midpoint while pinching pans with it', () => {
    // scale 150/100 = 1.5, anchor (100, 100) follows the midpoint to (130, 90): x = 130 - 150, y = 90 - 150
    expect(pinchView(start, focal, 100, { x: 130, y: 90 }, 150, 0.5, 3)).toEqual({ scale: 1.5, x: -20, y: -60 });
  });

  it('the scale is limited to [min, max] and the anchor still stays under the fingers', () => {
    // raw 10 -> 3: x = 100 - 300 = -200
    expect(pinchView(start, focal, 100, focal, 1000, 0.5, 3)).toEqual({ scale: 3, x: -200, y: -200 });
    // raw 0.1 -> 0.5: x = 100 - 50 = 50
    expect(pinchView(start, focal, 100, focal, 10, 0.5, 3)).toEqual({ scale: 0.5, x: 50, y: 50 });
  });

  it('starting from a zoomed, panned view keeps the content point that was under the fingers', () => {
    const from = { scale: 2, x: -300, y: -100 };
    const view = pinchView(from, { x: 150, y: 150 }, 80, { x: 150, y: 150 }, 120, 0.5, 4);
    // anchor ((150 + 300) / 2, (150 + 100) / 2) = (225, 125); scale 3: x = 150 - 675, y = 150 - 375
    expect(view).toEqual({ scale: 3, x: -525, y: -225 });
    expect(toContent(view, { x: 150, y: 150 })).toEqual({ x: 225, y: 125 });
  });

  it('a zero starting distance leaves the scale unchanged', () => {
    expect(pinchView({ scale: 2, x: 0, y: 0 }, focal, 0, focal, 50, 0.5, 3).scale).toBe(2);
  });
});

describe('centerOn', () => {
  it('puts the content point in the middle of the viewport', () => {
    // cell (7, 7) centre at 300px; scale 1: x = 150 - 300
    expect(centerOn({ x: 300, y: 300 }, 1, VIEWPORT)).toEqual({ scale: 1, x: -150, y: -150 });
    // corner cell centre (20, 20) at scale 2: 150 - 40 = 110 (clampView would pull that back to 0)
    expect(centerOn({ x: 20, y: 20 }, 2, VIEWPORT)).toEqual({ scale: 2, x: 110, y: 110 });
    expect(clampView(centerOn({ x: 20, y: 20 }, 2, VIEWPORT), CONTENT, VIEWPORT, 0.5, 3)).toEqual({ scale: 2, x: 0, y: 0 });
  });
});

describe('cellAt', () => {
  it('maps points at fit-to-width (scale 0.5, 20px cells on screen)', () => {
    const fit = { scale: 0.5, x: 0, y: 0 };
    expect(cellAt(fit, { x: 10, y: 10 }, 40, 15)).toEqual({ row: 0, col: 0 });
    expect(cellAt(fit, { x: 100, y: 30 }, 40, 15)).toEqual({ row: 1, col: 5 });
    expect(cellAt(fit, { x: 299, y: 299 }, 40, 15)).toEqual({ row: 14, col: 14 });
  });

  it('maps points when zoomed and panned', () => {
    // content point = (0 + 200, 0 + 120) -> col 5, row 3
    expect(cellAt({ scale: 1, x: -200, y: -120 }, { x: 0, y: 0 }, 40, 15)).toEqual({ row: 3, col: 5 });
    // scale 2, x -300: screen x 150 -> content 225 -> col 5; screen y 10 -> content (10 + 100) / 2 = 55 -> row 1
    expect(cellAt({ scale: 2, x: -300, y: -100 }, { x: 150, y: 10 }, 40, 15)).toEqual({ row: 1, col: 5 });
  });

  it('is null outside the board', () => {
    const small = { scale: 0.25, x: 75, y: 75 };
    expect(cellAt(small, { x: 10, y: 10 }, 40, 15)).toBeNull(); // content (-260, -260)
    expect(cellAt(small, { x: 225, y: 100 }, 40, 15)).toBeNull(); // content x = 600 -> col 15
    expect(cellAt(small, { x: 224, y: 100 }, 40, 15)).toEqual({ row: 2, col: 14 }); // (596, 100)
  });
});

describe('lerpView, distance, midpoint', () => {
  it('interpolates each component', () => {
    const a = { scale: 1, x: 0, y: -100 };
    const b = { scale: 2, x: -200, y: 100 };
    expect(lerpView(a, b, 0)).toEqual(a);
    expect(lerpView(a, b, 1)).toEqual(b);
    expect(lerpView(a, b, 0.5)).toEqual({ scale: 1.5, x: -100, y: 0 });
  });

  it('distance and midpoint of two touches', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpoint({ x: 10, y: 20 }, { x: 30, y: 60 })).toEqual({ x: 20, y: 40 });
  });
});
