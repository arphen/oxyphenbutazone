<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="trophy-icon">{{ winner === 0 ? '🤝' : '🏆' }}</div>
      
      <h2 class="title">{{ winner === 0 ? "It's a Tie!" : 'Game Over!' }}</h2>
      
      <div v-if="winner !== 0" class="winner-text">
        {{ winner === 1 ? 'Player 1' : 'Player 2' }} Wins!
      </div>
      
      <div class="final-scores">
        <div class="score-row" :class="{ winner: winner === 1 }">
          <span class="player-name">Player 1</span>
          <div class="score-details">
            <div class="score-breakdown">
              <span class="game-score">{{ gameScore1 }} pts</span>
              <span v-if="remaining1 > 0" class="penalty">-{{ remaining1 }}</span>
              <span v-if="remaining2 > 0 && remaining1 === 0" class="bonus">+{{ remaining2 }}</span>
            </div>
            <div class="final-score">{{ finalScore1 }}</div>
          </div>
        </div>
        
        <div class="score-row" :class="{ winner: winner === 2 }">
          <span class="player-name">Player 2</span>
          <div class="score-details">
            <div class="score-breakdown">
              <span class="game-score">{{ gameScore2 }} pts</span>
              <span v-if="remaining2 > 0" class="penalty">-{{ remaining2 }}</span>
              <span v-if="remaining1 > 0 && remaining2 === 0" class="bonus">+{{ remaining1 }}</span>
            </div>
            <div class="final-score">{{ finalScore2 }}</div>
          </div>
        </div>
      </div>
      
      <div class="explanation">
        <div v-if="remaining1 > 0 || remaining2 > 0">
          Final scores adjusted for remaining tiles in rack.
        </div>
      </div>
      
      <div class="button-row">
        <button @click="$emit('new-game')" class="new-game-btn">
          New Game
        </button>
        <button @click="$emit('close')" class="close-btn">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GameOverModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    winner: {
      type: Number,
      default: null
    },
    finalScore1: {
      type: Number,
      default: 0
    },
    finalScore2: {
      type: Number,
      default: 0
    },
    gameScore1: {
      type: Number,
      default: 0
    },
    gameScore2: {
      type: Number,
      default: 0
    },
    remaining1: {
      type: Number,
      default: 0
    },
    remaining2: {
      type: Number,
      default: 0
    }
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
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
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.95), rgba(22, 33, 62, 0.95));
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 40px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.4s ease-out;
  text-align: center;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.trophy-icon {
  font-size: 72px;
  margin-bottom: 20px;
  animation: bounce 0.6s ease-out;
}

@keyframes bounce {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

.title {
  font-size: 32px;
  font-weight: 800;
  color: #e4e4e7;
  margin: 0 0 10px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.winner-text {
  font-size: 24px;
  font-weight: 600;
  color: #fbbf24;
  margin-bottom: 30px;
  text-shadow: 0 2px 10px rgba(251, 191, 36, 0.5);
}

.final-scores {
  margin: 30px 0;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.score-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.score-row.winner {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.4);
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
}

.player-name {
  font-size: 18px;
  font-weight: 700;
  color: #e4e4e7;
}

.score-details {
  display: flex;
  align-items: center;
  gap: 20px;
}

.score-breakdown {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #a1a1aa;
}

.game-score {
  color: #e4e4e7;
}

.penalty {
  color: #fca5a5;
  font-weight: 600;
}

.bonus {
  color: #86efac;
  font-weight: 600;
}

.final-score {
  font-size: 28px;
  font-weight: 800;
  color: #60a5fa;
  min-width: 80px;
  text-align: right;
}

.explanation {
  font-size: 13px;
  color: #a1a1aa;
  margin: 20px 0;
  font-style: italic;
}

.button-row {
  display: flex;
  gap: 12px;
  margin-top: 30px;
}

button {
  flex: 1;
  padding: 14px 24px;
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.new-game-btn {
  background: rgba(34, 197, 94, 0.3);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.5);
}

.new-game-btn:hover {
  background: rgba(34, 197, 94, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(34, 197, 94, 0.4);
}

.close-btn {
  background: rgba(71, 85, 105, 0.3);
  color: #cbd5e1;
  border: 1px solid rgba(71, 85, 105, 0.5);
}

.close-btn:hover {
  background: rgba(71, 85, 105, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}
</style>
