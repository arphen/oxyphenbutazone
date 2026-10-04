<template>
  <div class="phone-board">
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
      <div
        ref="contentEl"
        class="pb-content"
      >
        <template
          v-for="(row, r) in board"
          :key="r"
        >
          <div
            v-for="(cell, c) in row"
            :key="c"
            class="pb-cell drop-zone"
            :class="cellClass(cell, r, c)"
            :data-board-row="r"
            :data-board-col="c"
          >
            <template v-if="isOccupied(cell)">
              <span class="pb-letter">{{ letterOf(cell) }}</span>
              <span class="pb-points">{{ pointsOf(cell) }}</span>
            </template>
            <span
              v-else-if="cell.type"
              class="pb-label"
            >{{ LABELS[cell.type] }}</span>
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
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { letterValue, BOARD_SIZE } from '../shared/rules';
import { fitScale, clampView, toContent, pinchView, centerOn, cellAt, lerpView, distance, midpoint } from '../utils/panzoom';

const props = defineProps({
  board: { type: Array, default: () => [] },
  language: { type: String, default: 'english' },
  /** The cell the laptop board last focused; the view pans there when it changes. */
  centerRow: { type: Number, default: 7 },
  centerCol: { type: Number, default: 7 },
  /** A rack tile is selected: empty squares are highlighted as targets. */
  placing: { type: Boolean, default: false },
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
  return {
    [cell.type]: Boolean(cell.type) && !occupied,
    tile: occupied,
    'is-new': occupied && cell.isNew,
    'is-blank': occupied && cell.isBlank,
    empty: !occupied,
    'pb-focus': focusCell.value && focusCell.value.row === r && focusCell.value.col === c,
  };
}

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
    setView({ scale: gesture.start.scale, x: gesture.start.x + p.x - gesture.origin.x, y: gesture.start.y + p.y - gesture.origin.y });
  } else if (gesture.type === 'pinch' && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    setView(pinchView(gesture.start, gesture.focal, gesture.dist, midpoint(a, b), distance(a, b), ...limits()));
  }
}

function release(e, cancelled) {
  if (!pointers.has(e.pointerId)) return;
  const p = localPoint(e);
  pointers.delete(e.pointerId);
  const wasTap = !cancelled && gesture?.type === 'pending' && e.timeStamp - gesture.time < TAP_MAX_MS;

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
  if (lastTap && time - lastTap.time < DOUBLE_TAP_MS && distance(lastTap.point, point) < DOUBLE_TAP_DIST) {
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
  background: #0b1220;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
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
  background: #1c2740;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.45);
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
}

.pb-cell.tw { background: #9f1d35; }
.pb-cell.dw { background: #9d3a6b; }
.pb-cell.tl { background: #1f4fb8; }
.pb-cell.dl { background: #2f6f95; }
.pb-cell.center { background: #9d3a6b; }

.pb-label {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: rgba(255, 255, 255, 0.92);
}

.pb-cell.center .pb-label {
  font-size: 22px;
  color: #fde68a;
}

.pb-cell.tile {
  background: linear-gradient(160deg, #fbecc0, #e9cf8c);
  box-shadow: inset 0 0 0 1px rgba(120, 80, 20, 0.55), inset 0 -2px 0 rgba(120, 80, 20, 0.35);
  border-radius: 3px;
}

.pb-cell.tile.is-new {
  background: linear-gradient(160deg, #fff3a8, #facc15);
  box-shadow: inset 0 0 0 3px #22c55e;
}

.pb-letter {
  font-size: 25px;
  font-weight: 800;
  line-height: 1;
  color: #1a1a2e;
}

.pb-cell.is-blank .pb-letter {
  color: #b45309;
  font-style: italic;
}

.pb-points {
  position: absolute;
  right: 3px;
  bottom: 1px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  color: #3f3f46;
}

.pb-viewport.placing .pb-cell.empty {
  box-shadow: inset 0 0 0 1px rgba(134, 239, 172, 0.55);
}

.pb-cell.pb-focus {
  animation: pbFocus 1.4s ease-out;
}

@keyframes pbFocus {
  0%,
  60% {
    box-shadow: inset 0 0 0 4px #fde047;
  }
  100% {
    box-shadow: inset 0 0 0 0 transparent;
  }
}

/* drag-and-drop from the rack (class set by the parent view) */
.pb-cell.drop-target-active {
  background: rgba(34, 197, 94, 0.75);
  box-shadow: inset 0 0 0 3px #86efac;
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
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #e4e4e7;
  font-weight: 700;
  font-size: 0.85rem;
}
</style>
