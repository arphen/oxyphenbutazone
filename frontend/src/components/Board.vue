<template>
  <div class="board">
    <div v-for="(row, rowIndex) in board" :key="rowIndex" class="board-row">
      <div v-for="(cell, colIndex) in row" :key="colIndex" 
           class="board-cell" 
           :class="[cell.type, { 'has-tile': cell.letter, 'new-tile': cell.isNew }]" 
           @dragover.prevent 
           @drop="onDrop(rowIndex, colIndex)"
           @click="onCellClick(rowIndex, colIndex)"
           :draggable="cell.letter !== ''"
           @dragstart="onDragStart(cell.letter, rowIndex, colIndex)">
        <span v-if="cell.letter" class="tile-letter">{{ cell.letter }}</span>
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
  methods: {
    onDrop(rowIndex, colIndex) {
      const data = JSON.parse(event.dataTransfer.getData('text/plain'));
      this.$emit('place-letter', { ...data, toRowIndex: rowIndex, toColIndex: colIndex });
    },
    onDragStart(letter, rowIndex, colIndex) {
      event.dataTransfer.setData('text/plain', JSON.stringify({ letter, from: 'board', fromRowIndex: rowIndex, fromColIndex: colIndex }));
    },
    onCellClick(rowIndex, colIndex) {
      this.$emit('cell-click', { row: rowIndex, col: colIndex });
    },
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

.board-cell:hover {
  background: rgba(40, 40, 60, 0.7);
}

/* Colorblind-friendly premium squares */
/* Double Letter - Light Blue */
.dl { 
  background: rgba(125, 211, 252, 0.25);
  box-shadow: inset 0 0 12px rgba(125, 211, 252, 0.3);
}
/* Triple Letter - Dark Blue */
.tl { 
  background: rgba(37, 99, 235, 0.35);
  box-shadow: inset 0 0 12px rgba(37, 99, 235, 0.4);
}
/* Double Word - Light Pink */
.dw { 
  background: rgba(244, 114, 182, 0.25);
  box-shadow: inset 0 0 12px rgba(244, 114, 182, 0.3);
}
/* Triple Word - Dark Pink */
.tw { 
  background: rgba(219, 39, 119, 0.35);
  box-shadow: inset 0 0 12px rgba(219, 39, 119, 0.4);
}
/* Center - Pink accent */
.center { 
  background: rgba(236, 72, 153, 0.3);
  box-shadow: inset 0 0 15px rgba(236, 72, 153, 0.4);
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
</style>
