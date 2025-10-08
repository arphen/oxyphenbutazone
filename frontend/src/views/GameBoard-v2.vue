<template>
  <div id="app">
    <!-- Mobile View -->
    <MobileRackView v-if="isMobileView" />
    
    <!-- Main Game View -->
    <template v-else>
      <div class="desktop-layout">
        <!-- Board Section -->
        <div class="board-section">
          <Board 
            :board="gameState?.board || []" 
            @cell-click="handleCellClick" 
          />
        </div>
        
        <!-- Sidebar -->
        <div class="sidebar">
          <!-- Header Controls -->
          <div class="sidebar-header">
            <button @click="toggleQR" class="icon-button" title="Toggle QR Codes">
              📱
            </button>
            <button @click="restartGame" class="icon-button" title="Restart Game">
              🔄
            </button>
          </div>
          
          <!-- QR Section (when visible) -->
          <div v-if="showQR" class="qr-section">
            <QRDisplay 
              :playerId="1" 
              playerName="P1"
              :rack="gameState?.player1.rack || []"
              :score="gameState?.player1.score || 0"
              :isCurrentPlayer="gameState?.player1.isCurrentPlayer || false"
              :gameId="gameState?.gameId || ''" 
            />
            <QRDisplay 
              :playerId="2" 
              playerName="P2"
              :rack="gameState?.player2.rack || []"
              :score="gameState?.player2.score || 0"
              :isCurrentPlayer="gameState?.player2.isCurrentPlayer || false"
              :gameId="gameState?.gameId || ''" 
            />
          </div>
          
          <!-- Players Info -->
          <div class="players-container">
            <div class="player-card" :class="{ active: gameState?.player1.isCurrentPlayer }">
              <div class="player-name">P1</div>
              <div class="player-score">{{ gameState?.player1.score || 0 }}</div>
            </div>
            <div class="player-card" :class="{ active: gameState?.player2.isCurrentPlayer }">
              <div class="player-name">P2</div>
              <div class="player-score">{{ gameState?.player2.score || 0 }}</div>
            </div>
          </div>
          
          <!-- Game History Table -->
          <div class="history-section">
            <h3>Game History</h3>
            <table class="history-table">
              <thead>
                <tr>
                  <th>Rnd</th>
                  <th>Player</th>
                  <th>Words</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(entry, index) in combinedHistory" :key="index" :class="entry.result">
                  <td>{{ entry.round }}</td>
                  <td>P{{ entry.player }}</td>
                  <td class="words-cell">
                    <span v-if="entry.action === 'pass'">
                      Passed turn
                    </span>
                    <span v-else-if="entry.action === 'exchange'">
                      Exchanged {{ entry.tilesExchanged }}
                    </span>
                    <span v-else-if="entry.action === 'invalid'">
                      ❌ {{ entry.words.map(w => w.word).join(', ') }}
                    </span>
                    <span v-else>{{ entry.words.map(w => w.word).join(', ') }}</span>
                  </td>
                  <td class="score-cell">
                    <span v-if="entry.action !== 'exchange' && entry.action !== 'invalid' && entry.action !== 'pass'">+{{ entry.totalScore }}</span>
                    <span v-else>—</span>
                  </td>
                </tr>
                <tr v-if="combinedHistory.length === 0">
                  <td colspan="4" class="no-history">No moves yet</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Message Box -->
          <div class="message-section" v-if="gameState?.message">
            <div class="message-box" :class="gameState?.messageType">
              {{ gameState.message }}
            </div>
          </div>
        </div>
      </div>
    </template>
    
    <!-- Game Over Modal -->
    <GameOverModal
      :show="gameState?.gameOver || false"
      :winner="gameState?.winner"
      :finalScore1="gameState?.finalScores?.player1 || 0"
      :finalScore2="gameState?.finalScores?.player2 || 0"
      :gameScore1="gameState?.player1.score || 0"
      :gameScore2="gameState?.player2.score || 0"
      :remaining1="gameState?.finalScores?.player1Remaining || 0"
      :remaining2="gameState?.finalScores?.player2Remaining || 0"
      @new-game="restartGame"
      @close="() => {}"
    />
  </div>
</template>

<script>
import Board from '../components/Board.vue';
import QRDisplay from '../components/QRDisplay.vue';
import MobileRackView from '../components/MobileRackView.vue';
import GameOverModal from '../components/GameOverModal.vue';

export default {
  name: 'GameBoard',
  components: {
    Board,
    QRDisplay,
    MobileRackView,
    GameOverModal,
  },
  data() {
    return {
      gameState: null,
      showQR: false,
      isMobileView: false,
      pollInterval: null,
    };
  },
  computed: {
    combinedHistory() {
      if (!this.gameState) return [];
      
      const player1History = this.gameState.player1?.history || [];
      const player2History = this.gameState.player2?.history || [];
      const combined = [];
      const maxLength = Math.max(player1History.length, player2History.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (player1History[i]) {
          let resultClass = 'valid-row';
          if (player1History[i].action === 'pass') {
            resultClass = 'pass-row';
          } else if (player1History[i].action === 'exchange') {
            resultClass = 'exchange-row';
          } else if (player1History[i].action === 'invalid') {
            resultClass = 'invalid-row';
          }
          combined.push({
            ...player1History[i],
            player: 1,
            round: i + 1,
            result: resultClass
          });
        }
        if (player2History[i]) {
          let resultClass = 'valid-row';
          if (player2History[i].action === 'pass') {
            resultClass = 'pass-row';
          } else if (player2History[i].action === 'exchange') {
            resultClass = 'exchange-row';
          } else if (player2History[i].action === 'invalid') {
            resultClass = 'invalid-row';
          }
          combined.push({
            ...player2History[i],
            player: 2,
            round: i + 1,
            result: resultClass
          });
        }
      }
      
      return combined;
    }
  },
  async mounted() {
    // Check if this is a mobile view
    const urlParams = new URLSearchParams(window.location.search);
    this.isMobileView = urlParams.get('view') === 'mobile';
    
    if (!this.isMobileView) {
      // Fetch initial game state
      await this.fetchGameState();
      
      // Poll for updates every 500ms
      this.pollInterval = setInterval(() => {
        this.fetchGameState();
      }, 500);
    }
  },
  beforeUnmount() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  },
  methods: {
    async fetchGameState() {
      try {
        const response = await fetch('/api/game-state');
        if (response.ok) {
          this.gameState = await response.json();
        }
      } catch (error) {
        console.error('Failed to fetch game state:', error);
      }
    },
    async handleCellClick({ row, col }) {
      // Update viewport center
      try {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'update-viewport',
            viewportCenter: { row, col }
          })
        });
      } catch (error) {
        console.error('Failed to update viewport:', error);
      }
    },
    toggleQR() {
      this.showQR = !this.showQR;
    },
    async handlePass() {
      const currentPlayer = this.gameState?.currentPlayer || 1;
      
      try {
        const response = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'pass',
            playerId: String(currentPlayer)
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          this.gameState = result.gameState;
        }
      } catch (error) {
        console.error('Failed to pass turn:', error);
      }
    },
    async restartGame() {
      if (!confirm('Are you sure you want to restart the game? All progress will be lost.')) {
        return;
      }
      
      try {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'restart' })
        });
        await this.fetchGameState();
      } catch (error) {
        console.error('Failed to restart game:', error);
      }
    },
  },
};
</script>

<style>
#app {
  font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
  color: #e4e4e7;
  padding: 0;
  margin: 0;
  max-width: 100%;
  width: 100%;
}

.desktop-layout {
  display: flex;
  min-height: 100vh;
  width: 100vw;
  gap: 0;
  margin: 0;
  padding: 0;
}

.board-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  min-width: 0;
}

.sidebar {
  width: 380px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.3);
}

.sidebar-header {
  display: flex;
  gap: 10px;
  padding: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
}

.icon-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e4e4e7;
  padding: 10px 15px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.icon-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.qr-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 15px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.players-container {
  display: flex;
  gap: 15px;
  padding: 20px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.player-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
  text-align: center;
  transition: all 0.3s ease;
  opacity: 0.6;
}

.player-card.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
  opacity: 1;
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
}

.player-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #a1a1aa;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.player-card.active .player-name {
  color: #60a5fa;
}

.player-score {
  font-size: 2.5rem;
  font-weight: 700;
  color: #e4e4e7;
}

.history-section {
  flex: 1;
  padding: 20px 15px;
  overflow-y: auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.history-section h3 {
  margin: 0 0 15px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.history-table thead {
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
}

.history-table th {
  padding: 12px 8px;
  text-align: left;
  font-size: 0.85rem;
  font-weight: 600;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
}

.history-table th:last-child {
  border-right: none;
}

.history-table tbody tr {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.2s ease;
}

.history-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.05);
}

.history-table tbody tr.valid-row {
  background: rgba(59, 130, 246, 0.05);
}

.history-table tbody tr.invalid-row {
  background: rgba(251, 146, 60, 0.05);
}

.history-table tbody tr.exchange-row {
  background: rgba(168, 85, 247, 0.05);
  font-style: italic;
}

.history-table tbody tr.pass-row {
  background: rgba(234, 179, 8, 0.05);
  font-style: italic;
  opacity: 0.7;
}

.history-table td {
  padding: 10px 8px;
  font-size: 0.9rem;
  color: #e4e4e7;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
}

.history-table td:last-child {
  border-right: none;
}

.words-cell {
  font-weight: 500;
  text-transform: uppercase;
  font-size: 0.85rem;
}

.score-cell {
  text-align: right;
  font-weight: 700;
  color: #60a5fa;
}

.no-history {
  text-align: center;
  color: #71717a;
  font-style: italic;
  padding: 30px !important;
}

.message-section {
  padding: 15px;
  background: rgba(0, 0, 0, 0.2);
}

.message-box {
  padding: 12px 15px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  backdrop-filter: blur(10px);
  border: 1px solid;
}

.message-box.success {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.4);
}

.message-box.error {
  background: rgba(251, 146, 60, 0.2);
  color: #fdba74;
  border-color: rgba(251, 146, 60, 0.4);
}

.message-box.info {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
  border-color: rgba(59, 130, 246, 0.4);
}
</style>
