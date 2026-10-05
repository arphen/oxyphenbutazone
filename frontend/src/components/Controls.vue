<template>
  <div class="controls">
    <div v-if="previewScore" class="preview">
      <div class="preview-header">Preview Score:</div>
      <div class="preview-words">
        <span v-for="(ws, index) in previewScore.wordScores" :key="index" class="word-score">
          {{ ws.word }} ({{ ws.score }})
        </span>
      </div>
      <div class="preview-total">
        Total: <strong>{{ previewScore.totalScore }}</strong> points
        <span v-if="previewScore.bingoBonus" class="bingo"> + BINGO!</span>
      </div>
    </div>
    <div class="button-row">
      <button @click="playMove" class="play-button">Play</button>
      <button @click="clearBoard" class="clear-button">Clear</button>
      <button @click="passMove" class="pass-button">Pass</button>
      <button @click="toggleExchangeMode" class="exchange-button">
        {{ exchangeMode ? 'Cancel Exchange' : 'Exchange' }}
      </button>
    </div>

    <div v-if="exchangeMode" class="exchange-panel">
      <div class="exchange-instructions">Select tiles to exchange:</div>
      <div class="exchange-rack">
        <div
          v-for="(letter, index) in currentRack"
          :key="index"
          class="exchange-tile"
          :class="{ selected: selectedTiles.includes(index) }"
          @click="toggleTileSelection(index)"
        >
          {{ letter }}
        </div>
      </div>
      <button
        @click="confirmExchange"
        class="confirm-exchange-button"
        :disabled="selectedTiles.length === 0"
      >
        Confirm Exchange ({{ selectedTiles.length }} tiles)
      </button>
    </div>

    <div v-if="message" :class="['message', messageType]">{{ message }}</div>
  </div>
</template>

<script>
export default {
  name: 'Controls',
  props: {
    message: {
      type: String,
      default: '',
    },
    messageType: {
      type: String,
      default: '',
    },
    previewScore: {
      type: Object,
      default: null,
    },
    currentRack: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      exchangeMode: false,
      selectedTiles: [],
    };
  },
  methods: {
    playMove() {
      this.$emit('play-move');
    },
    clearBoard() {
      this.$emit('clear-board');
    },
    passMove() {
      this.$emit('pass');
    },
    toggleExchangeMode() {
      this.exchangeMode = !this.exchangeMode;
      this.selectedTiles = [];
    },
    toggleTileSelection(index) {
      const tileIndex = this.selectedTiles.indexOf(index);
      if (tileIndex === -1) {
        this.selectedTiles.push(index);
      } else {
        this.selectedTiles.splice(tileIndex, 1);
      }
    },
    confirmExchange() {
      const tilesToExchange = this.selectedTiles.map((index) => this.currentRack[index]);
      this.$emit('exchange', tilesToExchange);
      this.exchangeMode = false;
      this.selectedTiles = [];
    },
  },
};
</script>

<style scoped>
.controls {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}

/* One action row: buttons share the row equally and truncate instead of
   pushing the row taller. Holds 4 compact actions on a 360px phone. */
.button-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
}

.preview {
  background: var(--accent-soft);
  border: 1px solid var(--accent-edge);
  color: var(--ink);
  padding: 15px;
  border-radius: var(--radius-md, 12px);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.preview-header {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-words {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.word-score {
  background: var(--surface-3);
  border: 1px solid var(--surface-edge);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.preview-total {
  font-size: 16px;
  padding-top: 8px;
  border-top: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.2));
}

.preview-total strong {
  font-size: 20px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.bingo {
  color: var(--warn, #fbbf24);
  font-weight: bold;
  /* A 50-point bonus is progress, not an occasion: one quiet arrival, no loop. */
  animation: oxy-arrive 220ms var(--ease-out, ease-out);
}

button {
  flex: 1 1 0;
  min-width: 0;
  min-height: 44px;
  padding: 10px 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.2));
  border-radius: var(--radius-sm, 8px);
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--surface-2);
  color: var(--ink);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

/* Below 400px four truncated labels get unreadable, so fall back to a
   compact 2x2 grid — still one block, still >=44px targets. */
@media (max-width: 400px) {
  .button-row {
    flex-wrap: wrap;
  }
  .button-row button {
    flex: 1 1 40%;
  }
}

button:hover:not(:disabled) {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

button:active:not(:disabled) {
  transform: translateY(0) scale(0.97);
  transition-duration: 60ms;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Play carries the game forward: the one primary button. The other actions
   stay matte — four hues for four buttons taught nothing (R1). */
.play-button {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
  flex: 1;
}

.play-button:hover:not(:disabled) {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

.exchange-panel {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-md, 12px);
  padding: 15px;
  animation: slideDown 0.3s ease-out;
}

.exchange-instructions {
  font-size: 13px;
  margin-bottom: 12px;
  color: var(--ink-muted, #a1a1aa);
  text-align: center;
}

.exchange-rack {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.exchange-tile {
  width: 45px;
  height: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--tile-face-hi, #fff), var(--tile-face-lo, #e9e6da));
  border: 1px solid var(--tile-edge, rgba(161, 98, 7, 0.5));
  border-radius: 6px;
  font-size: 20px;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out);
  color: var(--tile-ink, #1a1a2e);
  box-shadow:
    inset 0 1px 0 var(--cell-glint, transparent),
    var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.3));
}

.exchange-tile:hover {
  transform: translateY(-1px);
  border-color: var(--accent-edge);
}

.exchange-tile.selected {
  border-color: var(--accent-edge);
  box-shadow:
    0 0 0 2px var(--accent-edge),
    var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.3));
  transform: translateY(-2px);
}

.confirm-exchange-button {
  background: var(--primary);
  border: 1px solid var(--primary);
  color: var(--on-primary);
  padding: 12px 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  width: 100%;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: var(--radius-sm, 8px);
  transition: background-color var(--dur-quick) var(--ease-out);
}

.confirm-exchange-button:hover:not(:disabled) {
  background: var(--primary-hover);
}

.confirm-exchange-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.message {
  padding: 12px 15px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  border: 1px solid;
  border-radius: var(--radius-sm, 8px);
}

.message.success {
  background: var(--success-soft);
  color: var(--success);
  border-color: var(--success-edge);
}

.message.error {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: var(--danger-edge);
}
</style>
