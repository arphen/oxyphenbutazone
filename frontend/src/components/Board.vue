<template>
  <div class="board">
    <div v-for="(row, rowIndex) in board" :key="rowIndex" class="board-row">
      <div v-for="(cell, colIndex) in row" :key="colIndex" 
           class="board-cell" 
           :class="[
             cell.type, 
             { 
               'has-tile': cell.letter || cell.isBlank === true, 
               'new-tile': cell.isNew, 
               'blank-tile': cell.isBlank === true,
               'drag-over': dragOverCell && dragOverCell.row === rowIndex && dragOverCell.col === colIndex
             }
           ]" 
           @dragover.prevent="onDragOver($event, rowIndex, colIndex)" 
           @dragenter.prevent="onDragEnter($event, rowIndex, colIndex)"
           @dragleave.prevent="onDragLeave($event)"
           @drop.prevent.stop="onDrop($event, rowIndex, colIndex)"
           @click="onCellClick(rowIndex, colIndex)"
           :draggable="!!(cell.letter || cell.isBlank)"
           @dragstart="onDragStart($event, cell.letter, rowIndex, colIndex)">
        <span v-if="cell.letter || cell.isBlank === true" class="tile-letter">{{ cell.isBlank === true ? (cell.chosenLetter || '★').toUpperCase() : (cell.letter || '').toUpperCase() }}</span>
        <span v-if="cell.letter || cell.isBlank === true" class="tile-points">{{ getLetterValue(cell.isBlank === true ? cell.chosenLetter : cell.letter) }}</span>
        <span v-if="cell.isBlank === true" class="blank-indicator">★</span>
        <span v-else-if="!cell.letter && cell.isBlank !== true" class="premium-label">{{ getPremiumLabel(cell.type) }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Board',
  props: {
    board: {
      type: Array,
      required: true,
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
      event.dataTransfer.setData('text/plain', JSON.stringify({ 
        letter, 
        from: 'board', 
        fromRowIndex: rowIndex, 
        fromColIndex: colIndex 
      }));
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
        center: '★'
      };
      return labels[type] || '';
    },
    getLetterValue(letter) {
      if (!letter) return 0;
      const values = {
        'a': 1, 'e': 1, 'i': 1, 'o': 1, 'u': 1, 'l': 1, 'n': 1, 's': 1, 't': 1, 'r': 1,
        'd': 2, 'g': 2,
        'b': 3, 'c': 3, 'm': 3, 'p': 3,
        'f': 4, 'h': 4, 'v': 4, 'w': 4, 'y': 4,
        'k': 5,
        'j': 8, 'x': 8,
        'q': 10, 'z': 10
      };
      return values[letter.toLowerCase()] || 0;
    }
  },
};
</script>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  width: min(calc(100vh - 40px), calc(100vw - 420px));
  height: min(calc(100vh - 40px), calc(100vw - 420px));
  max-width: 900px;
  max-height: 900px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
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
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: clamp(16px, 2vw, 28px);
  font-weight: bold;
  text-transform: uppercase;
  position: relative;
  cursor: pointer;
  background: rgba(30, 30, 50, 0.6);
  transition: all 0.2s ease;
}

.board-cell:not(.has-tile):hover {
  background: rgba(40, 40, 60, 0.7);
}

.board-cell.drag-over {
  background: rgba(134, 239, 172, 0.4) !important;
  box-shadow: inset 0 0 20px rgba(74, 222, 128, 0.6);
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

/* Colorblind-friendly premium squares */
/* Double Letter - Light Blue */
.dl { 
  background: rgba(125, 211, 252, 0.25);
  box-shadow: inset 0 0 12px rgba(125, 211, 252, 0.3);
  color: #e0f2fe;
}
/* Triple Letter - Dark Blue */
.tl { 
  background: rgba(37, 99, 235, 0.35);
  box-shadow: inset 0 0 12px rgba(37, 99, 235, 0.4);
  color: #dbeafe;
}
/* Double Word - Light Pink */
.dw { 
  background: rgba(244, 114, 182, 0.25);
  box-shadow: inset 0 0 12px rgba(244, 114, 182, 0.3);
  color: #fce7f3;
}
/* Triple Word - Dark Pink */
.tw { 
  background: rgba(219, 39, 119, 0.35);
  box-shadow: inset 0 0 12px rgba(219, 39, 119, 0.4);
  color: #fbcfe8;
}
/* Center - Pink accent */
.center { 
  background: rgba(236, 72, 153, 0.3);
  box-shadow: inset 0 0 15px rgba(236, 72, 153, 0.4);
  color: #fce7f3;
}

.has-tile {
  background: linear-gradient(135deg, rgba(254, 240, 138, 0.9), rgba(252, 211, 77, 0.9));
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3), inset 0 0 15px rgba(255, 255, 255, 0.2);
}

.new-tile {
  background: linear-gradient(135deg, rgba(134, 239, 172, 0.9), rgba(74, 222, 128, 0.9));
  box-shadow: 0 0 20px rgba(74, 222, 128, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.3);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 20px rgba(74, 222, 128, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.3);
  }
  50% {
    box-shadow: 0 0 30px rgba(74, 222, 128, 0.8), inset 0 0 25px rgba(255, 255, 255, 0.4);
  }
}

.tile-letter {
  color: #1a1a2e;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.5);
  z-index: 1;
  font-weight: 800;
}

.blank-tile .tile-letter {
  color: #fbbf24;
}

.blank-indicator {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: clamp(8px, 1vw, 14px);
  color: #fbbf24;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  z-index: 3;
}

.tile-points {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: clamp(8px, 1vw, 12px);
  font-weight: 600;
  color: #52525b;
  z-index: 2;
}
</style>
