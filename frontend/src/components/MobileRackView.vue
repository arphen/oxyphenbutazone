<template>
  <div class="mobile-rack-view">
    <div class="header">
      <h1>{{ playerName }}</h1>
      <div class="status" :class="{ active: isMyTurn }">
        {{ isMyTurn ? "🟢 Your Turn" : "⏸️ Waiting..." }}
      </div>
    </div>
    
    <div class="score-display">
      <div class="score-label">Your Score</div>
      <div class="score-value">{{ playerScore }}</div>
    </div>
    
    <div class="rack-container">
      <div class="rack-label">Your Letters:</div>
      <div class="mobile-rack">
        <div v-for="(letter, index) in rack" :key="index" class="rack-tile">
          <div class="letter">{{ letter.toUpperCase() }}</div>
          <div class="points">{{ getLetterValue(letter) }}</div>
        </div>
      </div>
      <div v-if="rack.length === 0" class="empty-rack">
        No letters yet
      </div>
    </div>
    
    <div class="info">
      <p>📱 Keep this screen open during the game</p>
      <p>🔄 Auto-updates when tiles change</p>
      <button @click="refresh" class="refresh-button">↻ Refresh</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MobileRackView',
  data() {
    return {
      gameId: '',
      playerId: '',
      rack: [],
      playerScore: 0,
      currentPlayer: 1,
      updateInterval: null,
    };
  },
  computed: {
    playerName() {
      return this.playerId === '1' ? 'Player 1' : 'Player 2';
    },
    isMyTurn() {
      return String(this.currentPlayer) === this.playerId;
    },
  },
  mounted() {
    // Get game ID and player ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    this.gameId = urlParams.get('game') || 'default';
    this.playerId = urlParams.get('player') || '1';
    
    // Load initial data
    this.loadGameData();
    
    // Poll for updates every 1 second
    this.updateInterval = setInterval(() => {
      this.loadGameData();
    }, 1000);
  },
  beforeUnmount() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  },
  methods: {
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
      return values[letter.toLowerCase()] || 0;
    },
    loadGameData() {
      try {
        const gameData = localStorage.getItem(`oxyphenbutazone_game_${this.gameId}`);
        if (gameData) {
          const data = JSON.parse(gameData);
          if (this.playerId === '1') {
            this.rack = data.player1Rack || [];
            this.playerScore = data.player1Score || 0;
          } else {
            this.rack = data.player2Rack || [];
            this.playerScore = data.player2Score || 0;
          }
          this.currentPlayer = data.currentPlayer || 1;
        }
      } catch (error) {
        console.error('Error loading game data:', error);
      }
    },
    refresh() {
      this.loadGameData();
    },
  },
};
</script>

<style scoped>
.mobile-rack-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  font-family: Avenir, Helvetica, Arial, sans-serif;
}

.header {
  text-align: center;
  color: white;
  margin-bottom: 20px;
}

.header h1 {
  margin: 0 0 10px 0;
  font-size: 2rem;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.status {
  display: inline-block;
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  font-size: 1.1rem;
  font-weight: bold;
  transition: all 0.3s ease;
}

.status.active {
  background: #4CAF50;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.score-display {
  background: white;
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 20px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.score-label {
  font-size: 0.9rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 5px;
}

.score-value {
  font-size: 3rem;
  font-weight: bold;
  color: #764ba2;
}

.rack-container {
  background: white;
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.rack-label {
  font-size: 1.1rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 15px;
  text-align: center;
}

.mobile-rack {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.rack-tile {
  width: 90px;
  height: 90px;
  background: linear-gradient(135deg, #f0e68c 0%, #daa520 100%);
  border: 2px solid #333;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  position: relative;
}

.letter {
  font-size: 2.5rem;
  font-weight: bold;
  text-transform: uppercase;
  color: #333;
}

.points {
  position: absolute;
  bottom: 5px;
  right: 8px;
  font-size: 1rem;
  font-weight: bold;
  color: #666;
}

.empty-rack {
  text-align: center;
  padding: 30px;
  color: #999;
  font-size: 1.1rem;
}

.info {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 15px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.info p {
  margin: 10px 0;
  font-size: 0.95rem;
  color: #555;
}

.refresh-button {
  margin-top: 15px;
  padding: 12px 30px;
  font-size: 1.1rem;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
}

.refresh-button:hover {
  background: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.refresh-button:active {
  transform: translateY(0);
}
</style>
