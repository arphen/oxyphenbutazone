<template>
  <div v-if="isVisible" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Swap Tiles</h2>
        <button class="close-button" @click="closeModal">&times;</button>
      </div>
      <div class="modal-body">
        <p class="instructions">Select the tiles you want to exchange.</p>
        <div class="tiles-container">
          <div
            v-for="(letter, index) in rack"
            :key="index"
            class="tile"
            :class="{ selected: isSelected(index) }"
            @click="toggleTileSelection(index)"
          >
            <span class="letter">{{ (letter || '★').toUpperCase() }}</span>
            <span class="value">{{ getLetterValue(letter) }}</span>
          </div>
        </div>
        <div class="action-buttons">
          <button class="action-btn cancel-btn" @click="closeModal">Cancel</button>
          <button
            class="action-btn swap-btn"
            @click="confirmSwap"
            :disabled="selectedTiles.length === 0"
          >
            Swap {{ selectedTiles.length }} Tiles
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SwapTilesModal',
  props: {
    isVisible: {
      type: Boolean,
      required: true,
    },
    rack: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      selectedTiles: [],
    };
  },
  watch: {
    isVisible(newValue) {
      if (!newValue) {
        this.selectedTiles = [];
      }
    },
  },
  methods: {
    closeModal() {
      this.$emit('close');
    },
    toggleTileSelection(index) {
      const selectionIndex = this.selectedTiles.indexOf(index);
      if (selectionIndex > -1) {
        this.selectedTiles.splice(selectionIndex, 1);
      } else {
        this.selectedTiles.push(index);
      }
    },
    isSelected(index) {
      return this.selectedTiles.includes(index);
    },
    confirmSwap() {
      this.$emit('swap', this.selectedTiles);
      this.closeModal();
    },
    getLetterValue(letter) {
      const values = {
        'a': 1, 'e': 1, 'i': 1, 'o': 1, 'u': 1, 'l': 1, 'n': 1, 's': 1, 't': 1, 'r': 1,
        'd': 2, 'g': 2,
        'b': 3, 'c': 3, 'm': 3, 'p': 3,
        'f': 4, 'h': 4, 'v': 4, 'w': 4, 'y': 4,
        'k': 5,
        'j': 8, 'x': 8,
        'q': 10, 'z': 10,
        '': 0
      };
      return values[letter?.toLowerCase()] || 0;
    },
  },
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: #1a1a2e;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 15px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 1.8rem;
  cursor: pointer;
  line-height: 1;
}

.modal-body {
  padding: 20px;
  color: #e4e4e7;
}

.instructions {
  text-align: center;
  margin-bottom: 20px;
  font-size: 0.9rem;
  color: #a1a1aa;
}

.tiles-container {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 25px;
}

.tile {
  position: relative;
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #fde68a, #f59e0b);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.tile.selected {
  border-color: #60a5fa;
  transform: scale(1.1);
  box-shadow: 0 0 15px rgba(96, 165, 250, 0.5);
}

.tile .letter {
  font-size: 1.6rem;
  font-weight: 800;
  color: #1a1a2e;
}

.tile .value {
  position: absolute;
  bottom: 3px;
  right: 5px;
  font-size: 0.65rem;
  color: #52525b;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.action-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #e4e4e7;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.swap-btn {
  background: #3b82f6;
  color: white;
}

.swap-btn:disabled {
  background: #374151;
  cursor: not-allowed;
  opacity: 0.7;
}

.swap-btn:not(:disabled):hover {
  background: #2563eb;
}
</style>
