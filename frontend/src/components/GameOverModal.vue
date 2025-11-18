<template>
  <transition name="modal-fade">
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content">
        <!-- Animated Background -->
        <div class="animated-bg">
          <div class="particle" v-for="i in 20" :key="i" :style="getParticleStyle(i)"></div>
        </div>
        
        <!-- Trophy Icon -->
        <div class="trophy-container">
          <div class="trophy-icon">{{ isTie ? '🤝' : '🏆' }}</div>
          <div class="trophy-glow"></div>
        </div>
        
        <!-- Title -->
        <h2 class="title">{{ isTie ? "It's a Tie!" : 'Game Over!' }}</h2>
        
        <!-- Winner Announcement -->
        <div v-if="!isTie" class="winner-announcement">
          <div class="winner-badge">
            <span class="crown-icon">👑</span>
            <span class="winner-name">{{ winnerName }}</span>
            <span class="winner-label">Wins!</span>
          </div>
        </div>
        
        <!-- Podium for Players -->
        <div class="podium-container">
          <div 
            v-for="(player, index) in sortedPlayers" 
            :key="index"
            class="podium-player"
            :class="[
              `place-${index + 1}`,
              `player-${player.playerNum}`,
              { 'is-winner': player.isWinner }
            ]"
            :style="{ animationDelay: `${index * 0.1}s` }"
          >
            <!-- Place Medal -->
            <div class="place-medal">
              <span v-if="index === 0">🥇</span>
              <span v-else-if="index === 1">🥈</span>
              <span v-else-if="index === 2">🥉</span>
              <span v-else>{{ index + 1 }}</span>
            </div>
            
            <!-- Player Info -->
            <div class="player-avatar">
              <span>👤</span>
            </div>
            <div class="player-name">Player {{ player.playerNum }}</div>
            
            <!-- Score Breakdown -->
            <div class="score-breakdown">
              <div class="breakdown-line">
                <span class="label">Game Score:</span>
                <span class="value">{{ player.gameScore }}</span>
              </div>
              <div v-if="player.penalty > 0" class="breakdown-line penalty-line">
                <span class="label">Remaining Tiles:</span>
                <span class="value">-{{ player.penalty }}</span>
              </div>
              <div v-if="player.bonus > 0" class="breakdown-line bonus-line">
                <span class="label">Opponent Tiles:</span>
                <span class="value">+{{ player.bonus }}</span>
              </div>
              <div class="breakdown-line final-line">
                <span class="label">Final Score:</span>
                <span class="value final-value">{{ player.finalScore }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Explanation -->
        <div class="explanation">
          <span class="info-icon">💡</span>
          Final scores adjusted for remaining tiles
        </div>
        
        <!-- Action Buttons -->
        <div class="button-row">
          <button @click="$emit('new-game')" class="action-btn new-game-btn">
            <span class="btn-icon">🔄</span>
            <span>New Game</span>
          </button>
          <button @click="$emit('close')" class="action-btn close-btn">
            <span class="btn-icon">✕</span>
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  </transition>
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
    gameState: {
      type: Object,
      default: null
    },
    // Legacy props for backwards compatibility
    finalScore1: Number,
    finalScore2: Number,
    gameScore1: Number,
    gameScore2: Number,
    remaining1: Number,
    remaining2: Number,
  },
  computed: {
    playerCount() {
      return this.gameState?.playerCount || 2;
    },
    isTie() {
      return this.winner === 0;
    },
    winnerName() {
      if (this.isTie) return '';
      return `Player ${this.winner}`;
    },
    sortedPlayers() {
      const players = [];
      
      // Collect all player data
      for (let i = 1; i <= this.playerCount; i++) {
        const finalScore = this.gameState?.finalScores?.[`player${i}`] || 
                          (i === 1 ? this.finalScore1 : this.finalScore2) || 0;
        const gameScore = this.gameState?.[`player${i}`]?.score || 
                         (i === 1 ? this.gameScore1 : this.gameScore2) || 0;
        const remaining = this.gameState?.finalScores?.[`player${i}Remaining`] || 
                         (i === 1 ? this.remaining1 : this.remaining2) || 0;
        
        // Calculate bonus (opponent tiles if this player finished first)
        let bonus = 0;
        if (remaining === 0) {
          // This player might have finished - check if they get opponent tiles
          bonus = Math.max(0, finalScore - gameScore);
        }
        
        players.push({
          playerNum: i,
          finalScore,
          gameScore,
          penalty: remaining,
          bonus,
          isWinner: this.winner === i
        });
      }
      
      // Sort by final score (descending)
      return players.sort((a, b) => b.finalScore - a.finalScore);
    },
  },
  methods: {
    getParticleStyle(index) {
      const delay = Math.random() * 3;
      const duration = 3 + Math.random() * 4;
      const left = Math.random() * 100;
      
      return {
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`
      };
    },
  },
};
</script>

<style scoped>
/* Modal Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.modal-content {
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.98), rgba(22, 33, 62, 0.98));
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 50px;
  max-width: 900px;
  width: 95%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 
    0 30px 80px rgba(0, 0, 0, 0.6),
    0 0 100px rgba(59, 130, 246, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  animation: modalSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  text-align: center;
  position: relative;
  overflow: hidden;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(50px) rotateX(20deg);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0) rotateX(0deg);
  }
}

/* Animated Background */
.animated-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.particle {
  position: absolute;
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  animation: float 6s infinite ease-in-out;
}

@keyframes float {
  0%, 100% {
    transform: translateY(100vh) scale(0);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateY(-20px) scale(1);
    opacity: 0;
  }
}

/* Trophy Section */
.trophy-container {
  position: relative;
  display: inline-block;
  margin-bottom: 30px;
  z-index: 1;
}

.trophy-icon {
  font-size: 100px;
  display: inline-block;
  animation: trophyBounce 1s ease-out, trophyFloat 3s ease-in-out 1s infinite;
  filter: drop-shadow(0 10px 30px rgba(251, 191, 36, 0.5));
}

@keyframes trophyBounce {
  0% {
    transform: scale(0) rotate(-180deg);
    opacity: 0;
  }
  60% {
    transform: scale(1.2) rotate(10deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

@keyframes trophyFloat {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-15px) rotate(5deg);
  }
}

.trophy-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 150px;
  height: 150px;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.4), transparent 70%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: glowPulse 2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes glowPulse {
  0%, 100% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.8;
    transform: translate(-50%, -50%) scale(1.2);
  }
}

/* Title */
.title {
  font-size: 3rem;
  font-weight: 900;
  color: #e4e4e7;
  margin: 0 0 20px 0;
  text-transform: uppercase;
  letter-spacing: 3px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: titleSlide 0.6s ease-out 0.2s backwards;
  text-shadow: 0 4px 20px rgba(251, 191, 36, 0.3);
  position: relative;
  z-index: 1;
}

@keyframes titleSlide {
  from {
    opacity: 0;
    transform: translateX(-50px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Winner Announcement */
.winner-announcement {
  margin: 20px 0 40px;
  animation: winnerSlide 0.8s ease-out 0.4s backwards;
  position: relative;
  z-index: 1;
}

@keyframes winnerSlide {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.winner-badge {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 15px 30px;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(245, 158, 11, 0.3));
  border: 2px solid rgba(251, 191, 36, 0.5);
  border-radius: 50px;
  box-shadow: 0 10px 30px rgba(251, 191, 36, 0.4);
  animation: badgePulse 2s ease-in-out infinite;
}

@keyframes badgePulse {
  0%, 100% {
    box-shadow: 0 10px 30px rgba(251, 191, 36, 0.4);
  }
  50% {
    box-shadow: 0 15px 40px rgba(251, 191, 36, 0.6);
  }
}

.crown-icon {
  font-size: 2rem;
  animation: rotateCrown 3s linear infinite;
}

@keyframes rotateCrown {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.winner-name {
  font-size: 1.8rem;
  font-weight: 800;
  color: #fbbf24;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.winner-label {
  font-size: 1.2rem;
  color: #e4e4e7;
  font-weight: 600;
}

/* Podium Container */
.podium-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin: 40px 0;
  position: relative;
  z-index: 1;
}

.podium-player {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 25px;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: podiumRise 0.8s ease-out backwards;
  position: relative;
  overflow: hidden;
}

@keyframes podiumRise {
  from {
    opacity: 0;
    transform: translateY(50px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.podium-player::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}

.podium-player:hover::before {
  transform: translateX(100%);
}

.podium-player:hover {
  transform: translateY(-10px) scale(1.02);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.podium-player.is-winner {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.2));
  border-color: rgba(251, 191, 36, 0.6);
  box-shadow: 
    0 15px 40px rgba(251, 191, 36, 0.3),
    0 0 0 4px rgba(251, 191, 36, 0.1);
  transform: scale(1.05);
}

.podium-player.player-1 {
  border-color: rgba(59, 130, 246, 0.4);
}

.podium-player.player-2 {
  border-color: rgba(34, 197, 94, 0.4);
}

.podium-player.player-3 {
  border-color: rgba(245, 158, 11, 0.4);
}

.podium-player.player-4 {
  border-color: rgba(168, 85, 247, 0.4);
}

.place-medal {
  font-size: 3rem;
  margin-bottom: 15px;
  animation: medalSpin 1s ease-out;
}

@keyframes medalSpin {
  from {
    transform: rotateY(0deg);
  }
  to {
    transform: rotateY(720deg);
  }
}

.player-avatar {
  font-size: 3.5rem;
  margin-bottom: 10px;
  opacity: 0.9;
}

.player-name {
  font-size: 1.3rem;
  font-weight: 700;
  color: #e4e4e7;
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.score-breakdown {
  text-align: left;
  background: rgba(0, 0, 0, 0.3);
  padding: 15px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.breakdown-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.breakdown-line:last-child {
  border-bottom: none;
}

.breakdown-line .label {
  font-size: 0.9rem;
  color: #a1a1aa;
}

.breakdown-line .value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #e4e4e7;
}

.penalty-line .value {
  color: #fca5a5;
}

.bonus-line .value {
  color: #86efac;
}

.final-line {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 2px solid rgba(255, 255, 255, 0.2);
}

.final-line .label {
  font-size: 1rem;
  color: #e4e4e7;
  font-weight: 600;
}

.final-value {
  font-size: 2rem !important;
  color: #60a5fa !important;
  text-shadow: 0 2px 10px rgba(96, 165, 250, 0.5);
}

/* Explanation */
.explanation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.95rem;
  color: #a1a1aa;
  margin: 30px 0 20px;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  z-index: 1;
}

.info-icon {
  font-size: 1.2rem;
  animation: infoGlow 2s ease-in-out infinite;
}

@keyframes infoGlow {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

/* Action Buttons */
.button-row {
  display: flex;
  gap: 15px;
  margin-top: 30px;
  position: relative;
  z-index: 1;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 28px;
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  border: 2px solid;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  overflow: hidden;
}

.action-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transform: translate(-50%, -50%);
  transition: width 0.5s ease, height 0.5s ease;
}

.action-btn:hover::before {
  width: 300px;
  height: 300px;
}

.btn-icon {
  font-size: 1.3rem;
  position: relative;
  z-index: 1;
}

.action-btn span:last-child {
  position: relative;
  z-index: 1;
}

.new-game-btn {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.3));
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.5);
}

.new-game-btn:hover {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.4), rgba(22, 163, 74, 0.4));
  border-color: rgba(34, 197, 94, 0.8);
  transform: translateY(-3px);
  box-shadow: 0 10px 30px rgba(34, 197, 94, 0.4);
}

.close-btn {
  background: linear-gradient(135deg, rgba(71, 85, 105, 0.3), rgba(51, 65, 85, 0.3));
  color: #cbd5e1;
  border-color: rgba(71, 85, 105, 0.5);
}

.close-btn:hover {
  background: linear-gradient(135deg, rgba(71, 85, 105, 0.4), rgba(51, 65, 85, 0.4));
  border-color: rgba(71, 85, 105, 0.8);
  transform: translateY(-3px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

/* Scrollbar */
.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
}

.modal-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .modal-content {
    padding: 30px 20px;
  }
  
  .title {
    font-size: 2rem;
  }
  
  .trophy-icon {
    font-size: 70px;
  }
  
  .winner-name {
    font-size: 1.4rem;
  }
  
  .podium-container {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .button-row {
    flex-direction: column;
  }
  
  .action-btn {
    width: 100%;
  }
}
</style>
