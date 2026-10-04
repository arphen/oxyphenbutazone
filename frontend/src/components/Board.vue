<template>
  <div class="board" data-testid="board">
    <div v-for="(row, rowIndex) in board" :key="rowIndex" class="board-row">
      <div
        v-for="(cell, colIndex) in row"
        :key="colIndex"
        class="board-cell"
        :class="[
          cell.type,
          {
            'has-tile': cell.letter || cell.isBlank === true,
            'new-tile': cell.isNew,
            'blank-tile': cell.isBlank === true,
            'drag-over':
              dragOverCell && dragOverCell.row === rowIndex && dragOverCell.col === colIndex,
          },
        ]"
        @dragover.prevent="onDragOver($event, rowIndex, colIndex)"
        @dragenter.prevent="onDragEnter($event, rowIndex, colIndex)"
        @dragleave.prevent="onDragLeave($event)"
        @drop.prevent.stop="onDrop($event, rowIndex, colIndex)"
        @click="onCellClick(rowIndex, colIndex)"
        :draggable="!!(cell.letter || cell.isBlank)"
        :data-testid="`cell-${rowIndex}-${colIndex}`"
        @dragstart="onDragStart($event, cell.letter, rowIndex, colIndex)"
      >
        <span v-if="cell.letter || cell.isBlank === true" class="tile-letter">{{
          cell.isBlank === true
            ? (cell.chosenLetter || '★').toUpperCase()
            : (cell.letter || '').toUpperCase()
        }}</span>
        <span v-if="cell.letter || cell.isBlank === true" class="tile-points">{{
          getLetterValue(cell.isBlank === true ? cell.chosenLetter : cell.letter)
        }}</span>
        <span v-if="cell.isBlank === true" class="blank-indicator">★</span>
        <span v-else-if="!cell.letter && cell.isBlank !== true" class="premium-label">{{
          getPremiumLabel(cell.type)
        }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { letterValue } from '../shared/rules';
export default {
  name: 'Board',
  props: {
    board: {
      type: Array,
      required: true,
    },
    language: {
      type: String,
      default: 'english',
    },
  },
  data() {
    return {
      dragOverCell: null,
    };
  },
  methods: {
    onDragOver(event, rowIndex, colIndex) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    onDragEnter(event, rowIndex, colIndex) {
      event.preventDefault();
      // Only highlight empty cells
      const cell = this.board[rowIndex][colIndex];
      if (!cell.letter && cell.isBlank !== true) {
        this.dragOverCell = { row: rowIndex, col: colIndex };
      }
    },
    onDragLeave(event) {
      event.preventDefault();
      // Clear highlight when leaving
      this.dragOverCell = null;
    },
    onDrop(event, rowIndex, colIndex) {
      event.preventDefault();
      event.stopPropagation();
      this.dragOverCell = null;

      try {
        const dataStr = event.dataTransfer.getData('text/plain');
        if (!dataStr) {
          console.warn('No drag data found');
          return;
        }
        const data = JSON.parse(dataStr);
        this.$emit('place-letter', { ...data, toRowIndex: rowIndex, toColIndex: colIndex });
      } catch (error) {
        console.error('Error handling drop:', error);
      }
    },
    onDragStart(event, letter, rowIndex, colIndex) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(
        'text/plain',
        JSON.stringify({
          letter,
          from: 'board',
          fromRowIndex: rowIndex,
          fromColIndex: colIndex,
        })
      );
    },
    onCellClick(rowIndex, colIndex) {
      this.$emit('cell-click', { row: rowIndex, col: colIndex });
    },
    getPremiumLabel(type) {
      const labels = {
        dl: 'DL',
        tl: 'TL',
        dw: 'DW',
        tw: 'TW',
        center: '★',
      };
      return labels[type] || '';
    },
    getLetterValue(letter) {
      return letterValue(this.language, letter);
    },
  },
};
</script>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  /* Parent-relative: the flex column in row layouts constrains 100% to the
     board section, and full width in stacked (narrow) layouts. The vh term
     keeps the square on screen next to a sidebar/topbar. */
  width: min(calc(100vh - 150px), 100%, 900px);
  aspect-ratio: 1 / 1;
  max-height: calc(100vh - 150px);
  min-width: 240px;
  /* Macro depth lives on this one large surface — never per cell. */
  background: var(--glass, rgba(0, 0, 0, 0.4));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 2px solid var(--board-edge, rgba(255, 255, 255, 0.15));
  box-shadow: var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.5));
}

.board-row {
  display: flex;
  flex: 1;
}

.board-cell {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--board-line, rgba(255, 255, 255, 0.1));
  font-size: clamp(16px, 2vw, 28px);
  font-weight: bold;
  text-transform: uppercase;
  position: relative;
  cursor: pointer;
  background: var(--board-cell, rgba(30, 30, 50, 0.6));
  box-shadow: inset 0 1px 0 var(--cell-glint, transparent);
  transition:
    transform var(--dur-quick, 160ms) var(--ease-out, ease-out),
    background-color var(--dur-quick, 160ms) var(--ease-out, ease-out),
    box-shadow var(--dur-settle, 240ms) var(--ease-out, ease-out);
}

.board-cell:not(.has-tile):hover {
  background: var(--board-cell-hover, rgba(40, 40, 60, 0.7));
}

.board-cell:focus-visible {
  outline: 2px solid var(--focus-ring, #8dc7ff);
  outline-offset: -2px;
  z-index: 10;
}

.board-cell.drag-over {
  background: var(--success-soft, rgba(134, 239, 172, 0.4));
  box-shadow: inset 0 0 0 2px var(--success-edge, rgba(74, 222, 128, 0.6));
  transform: scale(1.05);
  z-index: 10;
}

.premium-label {
  font-size: clamp(10px, 1.2vw, 16px);
  text-align: center;
  line-height: 1;
  opacity: 0.85;
  font-weight: 700;
  letter-spacing: 0.5px;
}

/* Premium square palette: jewel tints keyed to meaning, never wood tones. */
.dl {
  background: var(--premium-dl, rgba(253, 224, 71, 0.24));
  color: var(--premium-dl-ink, #fef3c7);
}
.tl {
  background: var(--premium-tl, rgba(245, 158, 11, 0.4));
  color: var(--premium-tl-ink, #fef3c7);
}
.dw {
  background: var(--premium-dw, rgba(167, 139, 250, 0.28));
  color: var(--premium-dw-ink, #ede9fe);
}
.tw {
  background: var(--premium-tw, rgba(124, 58, 237, 0.42));
  color: var(--premium-tw-ink, #ede9fe);
}
.center {
  background: var(--premium-center, rgba(20, 184, 166, 0.38));
  color: var(--premium-center-ink, #ccfbf1);
}

/* Tiles: porcelain faces, dark ink — AAA in both themes. */
.has-tile {
  background: linear-gradient(135deg, var(--tile-face-hi, #fff), var(--tile-face-lo, #e9e6da));
  box-shadow:
    inset 0 1px 0 var(--cell-glint, transparent),
    var(--shadow-sm, 0 4px 8px rgba(0, 0, 0, 0.3));
  border-color: var(--tile-edge, #2a323d);
}

/* New tiles settle ONCE (220ms) — validation-green edge, then rest as tile.
   No infinite animation: motion runs on interaction, never while idle. */
.new-tile {
  background: linear-gradient(135deg, var(--tile-face-hi, #fff), var(--tile-face-lo, #e9e6da));
  box-shadow:
    0 0 0 2px var(--success-edge, rgba(74, 222, 128, 0.6)),
    var(--shadow-sm, 0 4px 8px rgba(0, 0, 0, 0.3));
  border-color: var(--success-edge, rgba(74, 222, 128, 0.6));
  animation: oxy-tile-settle 220ms var(--ease-out, ease-out);
}

@keyframes oxy-tile-settle {
  from {
    opacity: 0.35;
    transform: translateY(2px) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.tile-letter {
  color: var(--tile-ink, #1a1a2e);
  z-index: 1;
  font-weight: 800;
}

.blank-tile .tile-letter {
  color: var(--warn-deep, #92600a);
}

.blank-indicator {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: clamp(8px, 1vw, 14px);
  color: var(--warn-deep, #92600a);
  z-index: 3;
}

.tile-points {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: clamp(8px, 1vw, 12px);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--tile-sub, #52525b);
  z-index: 2;
}

@media (prefers-reduced-motion: reduce) {
  .board-cell,
  .new-tile {
    animation: none;
    transition: none;
  }
}
</style>
