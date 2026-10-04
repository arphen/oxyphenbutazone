// Pure pan/zoom maths for the phone board (no DOM, no Vue).
//
// A "view" is { scale, x, y }: the content (the board, laid out at its natural size) is drawn with
//   transform: translate(x, y) scale(scale)   and   transform-origin: 0 0
// so a content point c appears on screen (viewport-local pixels) at  x + c * scale.

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Scale at which content `contentWidth` wide exactly fills a viewport `viewportWidth` wide. */
export function fitScale(contentWidth, viewportWidth) {
  if (!(contentWidth > 0) || !(viewportWidth > 0)) return 1;
  return viewportWidth / contentWidth;
}

/**
 * One axis of a translation, clamped so the content can never leave the viewport:
 * content larger than the viewport must cover it completely (no empty gap at either edge),
 * content smaller than the viewport is centred.
 */
export function clampAxis(t, contentSize, scale, viewportSize) {
  const scaled = contentSize * scale;
  if (scaled <= viewportSize) return (viewportSize - scaled) / 2;
  return clamp(t, viewportSize - scaled, 0);
}

/** Clamp scale into [minScale, maxScale] and both translations into the viewport. */
export function clampView(view, content, viewport, minScale, maxScale) {
  const scale = clamp(view.scale, minScale, maxScale);
  return {
    scale,
    x: clampAxis(view.x, content.width, scale, viewport.width),
    y: clampAxis(view.y, content.height, scale, viewport.height),
  };
}

/** Viewport point -> content point under it. */
export function toContent(view, point) {
  return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
}

/** Change the scale while keeping the content point under `focal` (a viewport point) fixed on screen. */
export function zoomAbout(view, newScale, focal) {
  const ratio = newScale / view.scale;
  return {
    scale: newScale,
    x: focal.x - (focal.x - view.x) * ratio,
    y: focal.y - (focal.y - view.y) * ratio,
  };
}

/**
 * Two-finger pinch. `start` is the view when the second finger went down, `startFocal`/`startDistance` the midpoint
 * and distance of the two fingers then, `focal`/`distance` their current values. The content point that was under
 * the starting midpoint follows the current midpoint (so the gesture pans as well as zooms), and the scale follows
 * the finger spread, limited to [minScale, maxScale].
 */
export function pinchView(start, startFocal, startDistance, focal, distance, minScale, maxScale) {
  const raw = startDistance > 0 ? start.scale * (distance / startDistance) : start.scale;
  const scale = clamp(raw, minScale, maxScale);
  const anchor = toContent(start, startFocal);
  return { scale, x: focal.x - anchor.x * scale, y: focal.y - anchor.y * scale };
}

/** The view at `scale` that puts content point `point` in the middle of the viewport (not clamped). */
export function centerOn(point, scale, viewport) {
  return { scale, x: viewport.width / 2 - point.x * scale, y: viewport.height / 2 - point.y * scale };
}

/** The board cell { row, col } under viewport point `point`, or null outside the board. */
export function cellAt(view, point, cellSize, cells) {
  const c = toContent(view, point);
  const col = Math.floor(c.x / cellSize);
  const row = Math.floor(c.y / cellSize);
  if (row < 0 || col < 0 || row >= cells || col >= cells) return null;
  return { row, col };
}

/** Linear interpolation between two views, t in [0, 1]. */
export function lerpView(a, b, t) {
  return { scale: a.scale + (b.scale - a.scale) * t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
