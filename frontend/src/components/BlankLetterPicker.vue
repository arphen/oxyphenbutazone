<template>
  <div class="blank-picker-overlay" @click.self="$emit('cancel')">
    <div class="blank-picker">
      <div class="picker-header">
        <h3>Choose Letter for Blank</h3>
        <button @click="$emit('cancel')" class="close-btn">✕</button>
      </div>

      <div class="letter-grid">
        <button
          v-for="letter in alphabet"
          :key="letter"
          @click="selectLetter(letter)"
          class="letter-btn"
        >
          {{ letter.toUpperCase() }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { getAlphabet } from '../shared/rules';

export default {
  name: 'BlankLetterPicker',
  props: {
    // Letters the blank may stand for; defaults to the English alphabet
    alphabet: {
      type: Array,
      default: () => getAlphabet('english'),
    },
  },
  emits: ['select', 'cancel'],
  methods: {
    selectLetter(letter) {
      this.$emit('select', letter.toLowerCase());
    },
  },
};
</script>

<style scoped>
.blank-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.blank-picker {
  background: var(--surface-3);
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.2));
  border-radius: 14px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg, 0 20px 60px rgba(0, 0, 0, 0.6));
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.picker-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--ink);
  font-weight: 700;
}

.close-btn {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.2));
  color: var(--ink);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform var(--dur-quick, 160ms) var(--ease-out, ease-out),
    border-color var(--dur-quick, 160ms) var(--ease-out, ease-out);
  padding: 0;
}

.close-btn:hover {
  border-color: var(--accent-edge);
}

.close-btn:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.letter-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  overflow-y: auto;
  padding: 4px;
}

.letter-btn {
  aspect-ratio: 1;
  background: linear-gradient(135deg, var(--tile-face-hi, #fff), var(--tile-face-lo, #e9e6da));
  border: 1px solid var(--tile-edge, rgba(161, 98, 7, 0.6));
  box-shadow:
    inset 0 1px 0 var(--cell-glint, transparent),
    var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.3));
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--tile-ink, #1a1a2e);
  cursor: pointer;
  transition:
    transform var(--dur-quick, 160ms) var(--ease-out, ease-out),
    border-color var(--dur-quick, 160ms) var(--ease-out, ease-out);
  text-transform: uppercase;
}

.letter-btn:hover {
  transform: translateY(-1px);
  border-color: var(--accent-edge);
}

.letter-btn:active {
  transform: translateY(0) scale(0.97);
  transition-duration: 60ms;
}

@media (max-width: 480px) {
  .blank-picker {
    padding: 16px;
    width: 95%;
  }

  .letter-grid {
    gap: 8px;
    grid-template-columns: repeat(5, 1fr);
  }

  .letter-btn {
    font-size: 1.2rem;
  }
}
</style>
