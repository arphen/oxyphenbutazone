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
import { letterValue } from '../shared/rules';
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
    language: {
      type: String,
      default: 'english',
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
      return letterValue(this.language, letter);
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
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: var(--surface-3);
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg, 0 10px 40px rgba(0, 0, 0, 0.5));
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
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
  border-bottom: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--ink);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: var(--ink-muted);
  font-size: 1.8rem;
  cursor: pointer;
  line-height: 1;
}

.close-button:hover {
  color: var(--ink);
}

.modal-body {
  padding: 20px;
  color: var(--ink);
}

.instructions {
  text-align: center;
  margin-bottom: 20px;
  font-size: 0.9rem;
  color: var(--ink-muted);
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
  background: linear-gradient(135deg, var(--tile-face-hi, #fff), var(--tile-face-lo, #e9e6da));
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 1px 0 var(--cell-glint, transparent),
    var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.3));
  cursor: pointer;
  border: 2px solid var(--tile-edge, #2a323d);
  transition:
    transform var(--dur-quick, 160ms) var(--ease-out, ease-out),
    border-color var(--dur-quick, 160ms) var(--ease-out, ease-out);
}

.tile.selected {
  border-color: var(--accent-edge);
  transform: translateY(-2px);
  box-shadow:
    0 0 0 2px var(--accent-edge),
    var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.3));
}

.tile .letter {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--tile-ink, #1a1a2e);
}

.tile .value {
  position: absolute;
  bottom: 3px;
  right: 5px;
  font-size: 0.65rem;
  color: var(--tile-sub, #52525b);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.action-btn {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--surface-edge);
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform var(--dur-quick, 160ms) var(--ease-out, ease-out),
    background-color var(--dur-quick, 160ms) var(--ease-out, ease-out);
  font-size: 0.9rem;
}

.cancel-btn {
  background: var(--surface-2);
  color: var(--ink);
}

.cancel-btn:hover {
  border-color: var(--accent-edge);
}

.swap-btn {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}

.swap-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.swap-btn:not(:disabled):hover {
  background: var(--primary-hover);
}

.swap-btn:not(:disabled):active,
.cancel-btn:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}
</style>
