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
        <div v-for="(letter, index) in currentRack" 
             :key="index" 
             class="exchange-tile" 
             :class="{ selected: selectedTiles.includes(index) }"
             @click="toggleTileSelection(index)">
          {{ letter }}
        </div>
      </div>
      <button @click="confirmExchange" class="confirm-exchange-button" :disabled="selectedTiles.length === 0">
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
      const tilesToExchange = this.selectedTiles.map(index => this.currentRack[index]);
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
  gap: 12px;
}

.button-row {
  display: flex;
  gap: 8px;
}

.preview {
  background: rgba(59, 130, 246, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #e4e4e7;
  padding: 15px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
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
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  font-size: 13px;
  font-weight: 500;
}

.preview-total {
  font-size: 16px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.preview-total strong {
  font-size: 20px;
  color: #60a5fa;
}

.bingo {
  color: #fbbf24;
  font-weight: bold;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

button {
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(255, 255, 255, 0.05);
  color: #e4e4e7;
  backdrop-filter: blur(10px);
}

button:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.play-button {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.4);
  color: #86efac;
  flex: 1;
}

.play-button:hover {
  background: rgba(34, 197, 94, 0.3);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
}

.clear-button {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  flex: 1;
}

.clear-button:hover {
  background: rgba(239, 68, 68, 0.3);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.pass-button {
  background: rgba(234, 179, 8, 0.2);
  border-color: rgba(234, 179, 8, 0.4);
  color: #fde047;
  flex: 1;
}

.pass-button:hover {
  background: rgba(234, 179, 8, 0.3);
  box-shadow: 0 4px 12px rgba(234, 179, 8, 0.4);
}

.exchange-button {
  background: rgba(168, 85, 247, 0.2);
  border-color: rgba(168, 85, 247, 0.4);
  color: #c084fc;
  flex: 1;
}

.exchange-button:hover {
  background: rgba(168, 85, 247, 0.3);
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4);
}

.exchange-panel {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 15px;
  animation: slideDown 0.3s ease-out;
}

.exchange-instructions {
  font-size: 13px;
  margin-bottom: 12px;
  color: #a1a1aa;
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
  background: linear-gradient(135deg, rgba(254, 240, 138, 0.8), rgba(252, 211, 77, 0.8));
  border: 2px solid rgba(161, 98, 7, 0.5);
  font-size: 20px;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #1a1a2e;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.exchange-tile:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
}

.exchange-tile.selected {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.9), rgba(147, 51, 234, 0.9));
  color: white;
  border-color: rgba(168, 85, 247, 0.8);
  transform: translateY(-5px);
  box-shadow: 0 8px 16px rgba(168, 85, 247, 0.5);
}

.confirm-exchange-button {
  background: rgba(59, 130, 246, 0.3);
  border: 1px solid rgba(59, 130, 246, 0.5);
  color: #93c5fd;
  padding: 12px 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  width: 100%;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
}

.confirm-exchange-button:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.4);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.confirm-exchange-button:disabled {
  background: rgba(71, 85, 105, 0.3);
  border-color: rgba(71, 85, 105, 0.4);
  color: #64748b;
  cursor: not-allowed;
  opacity: 0.5;
}

.message {
  padding: 12px 15px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  backdrop-filter: blur(10px);
  border: 1px solid;
}

.message.success {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.4);
}

.message.error {
  background: rgba(251, 146, 60, 0.2);
  color: #fdba74;
  border-color: rgba(251, 146, 60, 0.4);
}
</style>
