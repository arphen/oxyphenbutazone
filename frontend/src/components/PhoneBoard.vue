<template>
  <div class="phone-board oxy-ground" :style="groundStyle">
    <div
      ref="viewportEl"
      class="pb-viewport"
      :class="{ placing, zoomed }"
      data-testid="phone-board"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @contextmenu.prevent
    >
      <div ref="contentEl" class="pb-content">
        <template v-for="(row, r) in board" :key="r">
          <div
            v-for="(cell, c) in row"
            :key="c"
            class="pb-cell drop-zone"
            :class="cellClass(cell, r, c)"
            :style="cellStyle(r, c)"
            :data-pole="poleFor(r, c)"
            :data-board-row="r"
            :data-board-col="c"
          >
            <i
              v-if="tickFor(r, c)"
              class="wtick"
              :class="`wtick-${tickFor(r, c)}`"
              aria-hidden="true"
            ></i>
            <i v-if="anchorFor(r, c)" class="wanchor" aria-hidden="true"></i>
            <template v-if="isOccupied(cell)">
              <span class="pb-letter">{{ letterOf(cell) }}</span>
              <span class="pb-points">{{ pointsOf(cell) }}</span>
            </template>
            <span v-else-if="cell.type" class="pb-label">{{ LABELS[cell.type] }}</span>
          </div>
        </template>
      </div>
    </div>
    <div class="pb-toolbar">
      <div class="pb-hint">
        <slot name="hint" />
      </div>
      <button
        type="button"
        class="pb-zoom-btn"
        :aria-label="zoomed ? 'Show whole board' : 'Zoom in'"
        @click="toggleZoom()"
      >
        {{ zoomed ? 'Fit' : 'Zoom' }}
      </button>
    </div>
  </div>
</template>

<script setup>
// The phone's board: the whole 15x15 board, pannable with one finger, pinch-zoomable with two, double-tap to toggle
// between fit-to-width and a close-up. Taps on cells are reported with 'cell-tap'; the parent calls consume() when the
// tap did something (placed or took back a tile), and only taps that did nothing can start a double-tap zoom.
//
// The transform is written straight to the element (never through Vue), so a gesture costs no re-render.
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { letterValue, BOARD_SIZE } from '../shared/rules';
import {
  fitScale,
  clampView,
  toContent,
  pinchView,
  centerOn,
  cellAt,
  lerpView,
  distance,
  midpoint,
} from '../utils/panzoom';

const props = defineProps({
  board: { type: Array, default: () => [] },
  language: { type: String, default: 'english' },
  /** The cell the laptop board last focused; the view pans there when it changes. */
  centerRow: { type: Number, default: 7 },
  centerCol: { type: Number, default: 7 },
  /** A rack tile is selected: empty squares are highlighted as targets. */
  placing: { type: Boolean, default: false },
  /** Word identity cues (S3/S6/S7); see Board.vue for the shape. */
  cues: { type: Object, default: null },
  /** "r,c" cells that just changed: committed tiles arrive once. */
  freshKeys: { type: Object, default: null },
});
const emit = defineEmits(['cell-tap']);

const CELL = 40; // natural cell size in px; the board is drawn at 600px and scaled
const CONTENT = { width: CELL * BOARD_SIZE, height: CELL * BOARD_SIZE };
const MAX_ZOOM = 3.5; // relative to fit-to-width
const DOUBLE_TAP_ZOOM = 2.5;
const TAP_SLOP = 10; // px a finger may wander and still count as a tap
const TAP_MAX_MS = 500;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_DIST = 32;
const LABELS = { tw: 'TW', dw: 'DW', tl: 'TL', dl: 'DL', center: '★' };

const viewportEl = ref(null);
const contentEl = ref(null);
const zoomed = ref(false);
const focusCell = ref(null);

let view = { scale: 1, x: 0, y: 0 };
let size = { width: 0, height: 0 };
let fit = 1;
let rafId = 0;
let animId = 0;
let focusTimer = 0;
let resizeObserver = null;
let rect = null;
const pointers = new Map(); // pointerId -> { x, y } (viewport-local)
let gesture = null; // { type: 'pending' | 'pan' | 'pinch', ... }
let lastTap = null; // an unconsumed tap that may become a double-tap
let pendingCenter = null; // a laptop focus change that arrived mid-gesture

// ------------------------------------------------------------ rendering

const isOccupied = (cell) => Boolean(cell && (cell.letter || cell.isBlank));
const letterOf = (cell) => ((cell.isBlank ? cell.chosenLetter : cell.letter) || '').toUpperCase();
const pointsOf = (cell) => (cell.isBlank ? 0 : letterValue(props.language, cell.letter));

function cellClass(cell, r, c) {
  const occupied = isOccupied(cell);
  const cue = props.cues?.cell?.[`${r},${c}`] || null;
  return {
    [cell.type]: Boolean(cell.type) && !occupied,
    tile: occupied,
    'is-new': occupied && cell.isNew,
    'is-blank': occupied && cell.isBlank,
    empty: !occupied,
    'pb-focus': focusCell.value && focusCell.value.row === r && focusCell.value.col === c,
    'wx-a': Boolean(cue) && cue.pole !== 'b',
    'wx-b': Boolean(cue) && cue.pole === 'b',
    'wspill-1': cue?.spill === 1,
    'wspill-2': cue?.spill === 2,
    wlatest: cue?.latest === true,
    fresh: props.freshKeys?.has?.(`${r},${c}`) === true && !cell.isNew,
  };
}

function cellStyle(r, c) {
  const cue = props.cues?.cell?.[`${r},${c}`] || null;
  return cue ? { '--rank': String(cue.rank) } : {};
}

function tickFor(r, c) {
  return props.cues?.cell?.[`${r},${c}`]?.tick || null;
}

function poleFor(r, c) {
  return props.cues?.cell?.[`${r},${c}`]?.pole || null;
}

function anchorFor(r, c) {
  if (!props.cues?.anchorKeys?.has?.(`${r},${c}`)) return false;
  const cell = props.board[r]?.[c];
  return !isOccupied(cell);
}

const groundStyle = computed(() => {
  const ground = props.cues?.ground;
  if (!ground) return {};
  return {
    '--remaining': String(ground.remaining ?? 1),
    '--libido': String(ground.libido ?? 1),
    '--ta-top': String(ground.taTop ?? 0),
    '--ta-bottom': String(ground.taBottom ?? 1),
    '--tb-top': String(ground.tbTop ?? 0),
    '--tb-bottom': String(ground.tbBottom ?? 1),
  };
});

const limits = () => [fit, fit * MAX_ZOOM];
const clamped = (v) => clampView(v, CONTENT, size, ...limits());

function apply() {
  if (contentEl.value) {
    contentEl.value.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`;
  }
}

function setView(next) {
  view = clamped(next);
  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      apply();
    });
  }
}

function syncZoomed() {
  zoomed.value = view.scale > fit * 1.02;
}

function cancelAnimation() {
  if (animId) cancelAnimationFrame(animId);
  animId = 0;
}

function animateTo(target, ms = 260) {
  cancelAnimation();
  const from = { ...view };
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    view = lerpView(from, target, eased);
    apply();
    if (t < 1) {
      animId = requestAnimationFrame(step);
    } else {
      animId = 0;
      view = target;
      apply();
      syncZoomed();
    }
  };
  animId = requestAnimationFrame(step);
}

const fitView = () => clamped({ scale: fit, x: 0, y: 0 });
const cellCentre = (row, col) => ({ x: (col + 0.5) * CELL, y: (row + 0.5) * CELL });

function centerOnCell(row, col) {
  animateTo(clamped(centerOn(cellCentre(row, col), view.scale, size)));
}

/** Toggle fit-to-width <-> close-up. `point` (viewport-local) is the spot to zoom into; default the middle. */
function toggleZoom(point) {
  if (zoomed.value) {
    animateTo(fitView());
    zoomed.value = false;
    return;
  }
  const p = point || { x: size.width / 2, y: size.height / 2 };
  animateTo(clamped(centerOn(toContent(view, p), fit * DOUBLE_TAP_ZOOM, size)));
  zoomed.value = true;
}

function measure() {
  const el = viewportEl.value;
  if (!el) return;
  const wasZoomed = zoomed.value;
  size = { width: el.clientWidth, height: el.clientHeight };
  fit = fitScale(CONTENT.width, size.width);
  view = wasZoomed ? clamped(view) : fitView();
  apply();
  syncZoomed();
}

// ------------------------------------------------------------ gestures

function localPoint(e) {
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function beginGesture() {
  if (contentEl.value) contentEl.value.style.willChange = 'transform';
}

function endGesture() {
  gesture = null;
  if (contentEl.value) contentEl.value.style.willChange = 'auto'; // re-raster crisply at the final scale
  syncZoomed();
  if (pendingCenter) {
    const { row, col } = pendingCenter;
    pendingCenter = null;
    centerOnCell(row, col);
  }
}

function startPinch() {
  const [a, b] = [...pointers.values()];
  gesture = { type: 'pinch', start: { ...view }, focal: midpoint(a, b), dist: distance(a, b) };
}

function startPan(point) {
  gesture = { type: 'pan', start: { ...view }, origin: point };
}

function onPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (pointers.size >= 2) return; // a third finger is ignored
  if (pointers.size === 0) {
    rect = viewportEl.value.getBoundingClientRect();
    cancelAnimation();
    beginGesture();
  }
  try {
    viewportEl.value.setPointerCapture(e.pointerId);
  } catch {
    /* synthetic pointers cannot always be captured */
  }
  const p = localPoint(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 1) {
    gesture = { type: 'pending', origin: p, start: { ...view }, time: e.timeStamp };
  } else {
    startPinch();
  }
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId) || !gesture) return;
  const p = localPoint(e);
  pointers.set(e.pointerId, p);

  if (gesture.type === 'pending') {
    if (distance(p, gesture.origin) < TAP_SLOP) return;
    gesture.type = 'pan';
  }
  if (gesture.type === 'pan') {
    setView({
      scale: gesture.start.scale,
      x: gesture.start.x + p.x - gesture.origin.x,
      y: gesture.start.y + p.y - gesture.origin.y,
    });
  } else if (gesture.type === 'pinch' && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    setView(
      pinchView(
        gesture.start,
        gesture.focal,
        gesture.dist,
        midpoint(a, b),
        distance(a, b),
        ...limits()
      )
    );
  }
}

function release(e, cancelled) {
  if (!pointers.has(e.pointerId)) return;
  const p = localPoint(e);
  pointers.delete(e.pointerId);
  const wasTap =
    !cancelled && gesture?.type === 'pending' && e.timeStamp - gesture.time < TAP_MAX_MS;

  if (pointers.size === 1) {
    // pinch -> pan with the finger that stayed
    startPan([...pointers.values()][0]);
    return;
  }
  if (pointers.size > 0) return;
  endGesture();
  if (wasTap) handleTap(p, e.timeStamp);
}

const onPointerUp = (e) => release(e, false);
const onPointerCancel = (e) => release(e, true);

function handleTap(point, time) {
  if (
    lastTap &&
    time - lastTap.time < DOUBLE_TAP_MS &&
    distance(lastTap.point, point) < DOUBLE_TAP_DIST
  ) {
    lastTap = null;
    toggleZoom(point);
    return;
  }
  let consumed = false;
  const cell = cellAt(view, point, CELL, BOARD_SIZE);
  if (cell) {
    emit('cell-tap', {
      row: cell.row,
      col: cell.col,
      consume: () => {
        consumed = true;
      },
    });
  }
  lastTap = consumed ? null : { time, point };
}

// ------------------------------------------------------------ laptop focus

watch(
  () => [props.centerRow, props.centerCol],
  ([row, col], [oldRow, oldCol]) => {
    if (row === oldRow && col === oldCol) return;
    focusCell.value = { row, col };
    clearTimeout(focusTimer);
    focusTimer = setTimeout(() => {
      focusCell.value = null;
    }, 1400);
    if (pointers.size > 0) {
      pendingCenter = { row, col }; // never fight a finger that is on the board
      return;
    }
    centerOnCell(row, col);
  }
);

onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(viewportEl.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  cancelAnimation();
  if (rafId) cancelAnimationFrame(rafId);
  clearTimeout(focusTimer);
});

defineExpose({
  toggleZoom,
  /** Test/debug: the current transform. */
  getView: () => ({ ...view, fit }),
});
</script>

<style scoped>
.phone-board {
  width: 100%;
}

.pb-viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  max-height: 72vh;
  overflow: hidden;
  touch-action: none; /* the board handles its own pan/zoom; the rest of the page scrolls normally */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  /* The board is the ground: a matte bezel, never glass, never a hand-picked
     hex (R10, R11). Cells and tiles below spend the shared tokens. */
  background: var(--board-bezel, #151b21);
  border-radius: 10px;
  border: 1px solid var(--board-edge, rgba(255, 255, 255, 0.12));
}

.pb-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 600px;
  height: 600px;
  display: grid;
  grid-template-columns: repeat(15, 40px);
  grid-template-rows: repeat(15, 40px);
  transform-origin: 0 0;
}

.pb-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Grout-dark seams between tiles so a run of empty squares never reads as
     one bar (R9); premium tints below name the square kind, nothing else. */
  background: var(--board-cell, rgb(32 40 52 / 0.72));
  box-shadow: inset 0 0 0 1px var(--board-line, rgb(255 255 255 / 0.09));
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
}

/* Premium squares: muted jewel washes keyed to meaning, never wood tones.
   Labels carry the kind in ink, so hue is never the only carrier. */
.pb-cell.tw {
  background: var(--premium-tw);
  color: var(--premium-tw-ink);
}
.pb-cell.dw {
  background: var(--premium-dw);
  color: var(--premium-dw-ink);
}
.pb-cell.tl {
  background: var(--premium-tl);
  color: var(--premium-tl-ink);
}
.pb-cell.dl {
  background: var(--premium-dl);
  color: var(--premium-dl-ink);
}
.pb-cell.center {
  background: var(--premium-center);
  color: var(--premium-center-ink);
}

.pb-label {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: inherit;
}

.pb-cell.center .pb-label {
  font-size: 22px;
}

/* Tiles stay light porcelain in both themes with dark ink (AAA); only the
   edge adapts. This is the anti-Scrabble rule: no khaki, no beige. */
.pb-cell.tile {
  background: linear-gradient(160deg, var(--tile-face-hi, #fff), var(--tile-face-lo, #e9e6da));
  box-shadow:
    inset 0 0 0 1px var(--tile-edge, #2a323d),
    inset 0 -2px 0 rgb(0 0 0 / 0.12);
  border-radius: 3px;
}

.pb-cell.tile.is-new {
  background: linear-gradient(160deg, var(--tile-face-hi, #fff), var(--tile-face-lo, #e9e6da));
  box-shadow: inset 0 0 0 3px var(--accent-edge, rgb(122 168 255 / 0.55));
  /* A placed tile arrives, it does not appear (§9.5). */
  animation: pbArrive 220ms var(--ease-out, ease-out);
}

.pb-letter {
  font-size: calc(25px * var(--scale, 1));
  font-weight: 800;
  line-height: 1;
  color: var(--tile-ink, #1a1a2e);
}

/* A committed tile arrives once, then rests (§9.5). */
.pb-cell.fresh {
  animation: pbArrive 220ms var(--ease-out, ease-out);
}

@keyframes pbArrive {
  from {
    opacity: 0.35;
    transform: translateY(2px) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.pb-cell.is-blank .pb-letter {
  color: var(--warn-deep, #92600a);
  font-style: italic;
}

.pb-points {
  position: absolute;
  right: 3px;
  bottom: 1px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  color: var(--tile-sub, #52525b);
}

.pb-viewport.placing .pb-cell.empty {
  box-shadow: inset 0 0 0 1px var(--accent-edge, rgb(122 168 255 / 0.55));
}

.pb-cell.pb-focus {
  animation: pbFocus 1.4s ease-out;
}

@keyframes pbFocus {
  0%,
  60% {
    box-shadow: inset 0 0 0 4px var(--focus-ring, #8dc7ff);
  }
  100% {
    box-shadow: inset 0 0 0 0 transparent;
  }
}

/* A finger's drop target is interaction, not a verdict: the accent, steady. */
.pb-cell.drop-target-active {
  background: var(--accent-soft, rgb(122 168 255 / 0.16));
  box-shadow: inset 0 0 0 3px var(--accent-edge, rgb(122 168 255 / 0.55));
}

.pb-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  min-height: 44px;
}

.pb-hint {
  flex: 1;
  min-width: 0;
}

.pb-zoom-btn {
  flex: 0 0 auto;
  min-width: 64px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.2));
  background: var(--surface-2, rgba(255, 255, 255, 0.08));
  color: var(--ink, #e4e4e7);
  font-weight: 700;
  font-size: 0.85rem;
}
</style>
