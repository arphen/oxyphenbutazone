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
    <button @click="playMove" class="play-button">Play</button>
    <button @click="clearBoard" class="clear-button">Clear</button>
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
  },
  methods: {
    playMove() {
      this.$emit('play-move');
    },
    clearBoard() {
      this.$emit('clear-board');
    },
  },
};
</script>

<style scoped>
.controls {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.preview {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 15px 25px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  min-width: 250px;
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
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.preview-words {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  justify-content: center;
}

.word-score {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
}

.preview-total {
  font-size: 18px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.3);
}

.preview-total strong {
  font-size: 22px;
  color: #ffd700;
}

.bingo {
  color: #ffd700;
  font-weight: bold;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

button {
  padding: 10px 20px;
  font-size: 16px;
  margin: 0 5px;
  cursor: pointer;
  border: 2px solid #333;
  border-radius: 4px;
}

.play-button {
  background-color: #4CAF50;
  color: white;
}

.play-button:hover {
  background-color: #45a049;
}

.clear-button {
  background-color: #f44336;
  color: white;
}

.clear-button:hover {
  background-color: #da190b;
}

.message {
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  margin-top: 10px;
}

.message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
</style>
