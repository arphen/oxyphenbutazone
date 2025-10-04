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
  width: 600px;
  height: 600px;
  border: 2px solid #333;
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
  border: 1px solid #ccc;
  font-size: 24px;
  font-weight: bold;
  text-transform: uppercase;
  position: relative;
  cursor: pointer;
}

.dl { background-color: #a0d8ef; }
.tl { background-color: #00a8e8; }
.dw { background-color: #f0a8a8; }
.tw { background-color: #ff6b6b; }
.center { background-color: #f0a8a8; }

.has-tile {
  background-image: linear-gradient(135deg, rgba(245, 222, 179, 0.85), rgba(222, 184, 135, 0.85));
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);
}

.new-tile {
  background-image: linear-gradient(135deg, rgba(255, 235, 205, 0.9), rgba(255, 218, 185, 0.9));
  box-shadow: inset 0 0 15px rgba(255, 165, 0, 0.3), 0 0 8px rgba(255, 165, 0, 0.4);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: inset 0 0 15px rgba(255, 165, 0, 0.3), 0 0 8px rgba(255, 165, 0, 0.4);
  }
  50% {
    box-shadow: inset 0 0 15px rgba(255, 165, 0, 0.5), 0 0 12px rgba(255, 165, 0, 0.6);
  }
}

.tile-letter {
  color: #2c3e50;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.8);
  z-index: 1;
}
</style>
