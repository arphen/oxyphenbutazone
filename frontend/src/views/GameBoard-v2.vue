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
            :language="gameState?.language" 
            @cell-click="handleCellClick" 
          />
        </div>
        
        <!-- Sidebar -->
        <div class="sidebar">
          <!-- Header Controls -->
          <div class="sidebar-header">
            <button @click="goHome" class="icon-button" title="Back to Menu">
              🏠
            </button>
            <button @click="toggleQR" class="icon-button" title="Toggle QR Codes">
              📱
            </button>
            <DictionaryChooser 
              :selectedDictionaries="selectedDictionaries"
              :language="gameState?.language"
              @update="handleDictionaryUpdate"
            />
            <button @click="restartGame" class="icon-button" title="Restart Game">
              🔄
            </button>
            <button @click="testSound" class="icon-button" title="Test Sound">
              🔊
            </button>
          </div>
          
          <!-- Players Info -->
          <div class="players-container">
            <div 
              v-for="playerNum in playerCount" 
              :key="playerNum"
              class="player-card" 
              :class="{ 
                active: gameState?.[`player${playerNum}`]?.isCurrentPlayer,
                [`player-${playerNum}`]: true
              }"
            >
              <div class="player-badge">
                <span class="player-icon">👤</span>
              </div>
              <div class="player-info">
                <div class="player-name">P{{ playerNum }}</div>
                <div class="player-score">{{ gameState?.[`player${playerNum}`]?.score || 0 }}</div>
              </div>
            </div>
          </div>
          
          <!-- Tiles Remaining Counter -->
          <div class="tiles-remaining" :class="getTilesRemainingClass()">
            <div class="tiles-icon">🎲</div>
            <div class="tiles-info">
              <div class="tiles-label">Tiles Left</div>
              <div class="tiles-count">{{ tilesRemaining }}</div>
            </div>
          </div>
          
          <!-- Game History Table -->
          <div class="history-section">
            <h3>Game History</h3>
            <div class="history-table-wrapper">
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
                        <span v-for="(wordObj, idx) in entry.words" :key="idx">
                          <span class="word-with-definition" :title="wordObj.definition">
                            ❌ {{ wordObj.word }}
                          </span>
                          <span v-if="idx < entry.words.length - 1">, </span>
                        </span>
                      </span>
                      <span v-else>
                        <span v-for="(wordObj, idx) in entry.words" :key="idx">
                          <span class="word-with-definition" :title="wordObj.definition">
                            {{ wordObj.word }}
                          </span>
                          <span v-if="idx < entry.words.length - 1">, </span>
                        </span>
                      </span>
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
      :gameState="gameState"
      :finalScore1="gameState?.finalScores?.player1 || 0"
      :finalScore2="gameState?.finalScores?.player2 || 0"
      :gameScore1="gameState?.player1.score || 0"
      :gameScore2="gameState?.player2.score || 0"
      :remaining1="gameState?.finalScores?.player1Remaining || 0"
      :remaining2="gameState?.finalScores?.player2Remaining || 0"
      @new-game="restartGame"
      @close="handleGameOverClose"
    />
    
    <!-- QR Modal -->
    <QRModal
      :show="showQR"
      :players="qrPlayers"
      :playerCount="playerCount"
      @close="toggleQR"
    />
  </div>
</template>

<script>
import Board from '../components/Board.vue';
import QRModal from '../components/QRModal.vue';
import MobileRackView from '../components/MobileRackView.vue';
import GameOverModal from '../components/GameOverModal.vue';
import DictionaryChooser from '../components/DictionaryChooser.vue';
import { useSoundEffects } from '../composables/useSoundEffects.js';
import { useGamePersistence } from '../composables/useGamePersistence.js';
import { debug } from '../utils/log';

export default {
  name: 'GameBoard',
  components: {
    Board,
    QRModal,
    MobileRackView,
    GameOverModal,
    DictionaryChooser,
  },
  setup() {
    const { playClickSound, testSound } = useSoundEffects();
    const gamePersistence = useGamePersistence();
    return {
      playClickSound,
      testSound,
      gamePersistence
    };
  },
  data() {
    return {
      gameState: null,
      showQR: false,
      isMobileView: false,
      pollInterval: null,
      selectedDictionaries: { csw21: true, nwl2023: false, enable: false, slovenian: false },
      lastServerDictionaries: null,
      playerCount: 4, // Default to 4 players, can be changed from route params
    };
  },
  computed: {
    qrPlayers() {
      if (!this.gameState) return [];
      return Array.from({ length: this.playerCount }, (_, i) => {
        const playerNum = i + 1;
        const player = this.gameState[`player${playerNum}`];
        return {
          name: `Player ${playerNum}`,
          score: player?.score || 0,
          isCurrentPlayer: player?.isCurrentPlayer || false,
          rack: player?.rack || [],
        };
      });
    },
    tilesRemaining() {
      if (!this.gameState) return 100;
      
      // Standard word-tile game has 100 tiles total
      // Calculate tiles in play: on board + in racks
      let totalRackSize = 0;
      for (let i = 1; i <= this.playerCount; i++) {
        totalRackSize += this.gameState[`player${i}`]?.rack?.length || 0;
      }
      
      // Count tiles on board
      let tilesOnBoard = 0;
      if (this.gameState.board) {
        for (const row of this.gameState.board) {
          for (const cell of row) {
            if (cell.letter || cell.isBlank) tilesOnBoard++;
          }
        }
      }
      
      const tilesInPlay = totalRackSize + tilesOnBoard;
      return Math.max(0, 100 - tilesInPlay);
    },
    combinedHistory() {
      if (!this.gameState) return [];
      
      // Collect histories from all players
      const playerHistories = [];
      let maxLength = 0;
      
      for (let i = 1; i <= this.playerCount; i++) {
        const history = this.gameState[`player${i}`]?.history || [];
        playerHistories.push(history);
        maxLength = Math.max(maxLength, history.length);
      }
      
      const combined = [];
      
      for (let round = 0; round < maxLength; round++) {
        for (let playerNum = 1; playerNum <= this.playerCount; playerNum++) {
          const history = playerHistories[playerNum - 1];
          if (history[round]) {
            let resultClass = 'valid-row';
            if (history[round].action === 'pass') {
              resultClass = 'pass-row';
            } else if (history[round].action === 'exchange') {
              resultClass = 'exchange-row';
            } else if (history[round].action === 'invalid') {
              resultClass = 'invalid-row';
            }
            combined.push({
              ...history[round],
              player: playerNum,
              round: round + 1,
              result: resultClass
            });
          }
        }
      }
      
      // Reverse to show most recent moves first
      return combined.reverse();
    }
  },
  async mounted() {
    // Check if this is a mobile view
    const urlParams = new URLSearchParams(this.$route.query);
    this.isMobileView = urlParams.get('view') === 'mobile';
    
    // Get player count from route params or query
    const routePlayerCount = this.$route.params.playerCount || this.$route.query.players;
    if (routePlayerCount) {
      this.playerCount = Math.min(4, Math.max(2, parseInt(routePlayerCount)));
    }
    
    if (!this.isMobileView) {
      // Check if we should start a new game
      const shouldRestart = this.$route.query.newGame === 'true';
      
      if (shouldRestart) {
        // Initialize game with correct player count first
        debug('[GameBoard] Initializing new game with', this.playerCount, 'players');
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            type: 'restart',
            playerCount: this.playerCount,
            language: this.$route.query.language
          })
        });
        
        // Remove the newGame query param so a refresh doesn't restart again
        const query = { ...this.$route.query };
        delete query.newGame;
        this.$router.replace({ query });
      } else {
        debug('[GameBoard] Joining existing game');
      }
      
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
    goHome() {
      this.$router.push('/');
    },
    async fetchGameState() {
      try {
        const response = await fetch('/api/game-state');
        if (response.ok) {
          const newGameState = await response.json();
          
          // Initialize game persistence if this is the first state and no current game exists
          const isFirstFetch = !this.gameState;
          if (isFirstFetch && !this.gamePersistence.currentGameId.value) {
            // Check if this is a fresh game (no moves yet) OR if we need to recover mid-game
            const hasNoMoves = (!newGameState.player1?.history || newGameState.player1.history.length === 0) &&
                              (!newGameState.player2?.history || newGameState.player2.history.length === 0);
            
            if (hasNoMoves && !newGameState.gameOver) {
              // Fresh game, initialize it
              this.gamePersistence.startNewGame(newGameState);
              debug('[GamePersistence] Initialized new game:', this.gamePersistence.currentGameId.value);
            } else if (!hasNoMoves || newGameState.gameOver) {
              // Game in progress or completed but we don't have it tracked
              // This can happen if page was refreshed mid-game
              console.warn('[GamePersistence] Game in progress detected but not tracked. Starting tracking now.');
              this.gamePersistence.startNewGame(newGameState);
            }
          }
          
          // Detect new moves by comparing history lengths
          if (this.gameState && this.gamePersistence.currentGameId.value) {
            const oldP1Moves = this.gameState.player1?.history?.length || 0;
            const oldP2Moves = this.gameState.player2?.history?.length || 0;
            const newP1Moves = newGameState.player1?.history?.length || 0;
            const newP2Moves = newGameState.player2?.history?.length || 0;
            
            // Check if player 1 made a new move
            if (newP1Moves > oldP1Moves) {
              const lastMove = newGameState.player1.history[newP1Moves - 1];
              debug('[GameBoard] Player 1 made a move, recording it');
              this.recordMoveFromHistory(newGameState, '1', lastMove);
            }
            
            // Check if player 2 made a new move
            if (newP2Moves > oldP2Moves) {
              const lastMove = newGameState.player2.history[newP2Moves - 1];
              debug('[GameBoard] Player 2 made a move, recording it');
              this.recordMoveFromHistory(newGameState, '2', lastMove);
            }
          }
          
          // Check if new tiles were placed (detect isNew tiles)
          if (this.gameState && newGameState.board) {
            let hasNewTiles = false;
            
            for (let row = 0; row < newGameState.board.length; row++) {
              for (let col = 0; col < newGameState.board[row].length; col++) {
                const newCell = newGameState.board[row][col];
                const oldCell = this.gameState.board?.[row]?.[col];
                
                // If there's a letter now that wasn't there before, play sound
                if (newCell.letter && (!oldCell || !oldCell.letter)) {
                  hasNewTiles = true;
                  break;
                }
              }
              if (hasNewTiles) break;
            }
            
            if (hasNewTiles) {
              debug('[GameBoard] New tiles detected, playing sound');
              this.playClickSound();
            }
          }
          
          // Update player count from game state to ensure consistency
          if (newGameState.playerCount) {
            this.playerCount = newGameState.playerCount;
          }

          this.gameState = newGameState;

          // Mirror the server's dictionary selection, but only when the server's value changed,
          // so a poll can't flicker a checkbox the user just toggled.
          const serverDicts = JSON.stringify(newGameState.dictionaries || null);
          if (newGameState.dictionaries && serverDicts !== this.lastServerDictionaries) {
            this.lastServerDictionaries = serverDicts;
            this.selectedDictionaries = { ...newGameState.dictionaries };
          }
          
          // Check if game just ended
          if (newGameState.gameOver && this.gamePersistence.currentGameId.value) {
            const currentGame = this.gamePersistence.getCurrentGame();
            if (currentGame && currentGame.status !== 'completed') {
              debug('[GameBoard] Game ended, completing it');
              this.gamePersistence.completeGame(newGameState);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch game state:', error);
      }
    },
    getTilesRemainingClass() {
      const remaining = this.tilesRemaining;
      if (remaining > 50) return 'tiles-high';
      if (remaining > 25) return 'tiles-medium';
      if (remaining > 10) return 'tiles-low';
      return 'tiles-critical';
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
          body: JSON.stringify({ 
            type: 'restart',
            playerCount: this.playerCount 
          })
        });
        await this.fetchGameState();
        
        // Initialize new game in persistence
        if (this.gameState) {
          this.gamePersistence.startNewGame(this.gameState);
        }
      } catch (error) {
        console.error('Failed to restart game:', error);
      }
    },
    recordMoveFromHistory(gameState, playerNum, historyEntry) {
      // Extract move details from the backend history entry
      // Map backend action to our action types
      const action = historyEntry.action === 'play' ? 'play-word' : 
                     historyEntry.action === 'pass' ? 'pass' :
                     historyEntry.action === 'exchange' ? 'exchange' : 'play-word';
      
      const metadata = {
        playerId: playerNum,
        tilesPlaced: historyEntry.tiles || [],
        wordsFormed: historyEntry.words || [],
        scoreBefore: gameState[`player${playerNum}`]?.score - (historyEntry.points || 0) || 0,
        rackBefore: [], // We don't have rack before from history
        valid: true
      };
      
      // Add move-specific data based on action type
      if (historyEntry.action === 'exchange') {
        metadata.tilesExchanged = historyEntry.tiles?.length || 0;
      }
      
      debug('[GameBoard] Recording move from history:', {
        action,
        playerNum,
        historyEntry,
        metadata,
        gameState: {
          hasBoard: !!gameState.board,
          boardLength: gameState.board?.length
        }
      });
      
      this.gamePersistence.saveMove(gameState, action, metadata);
    },
    
    handleGameOverClose() {
      // When the game over modal is closed, complete the game if not already done
      if (this.gameState?.gameOver && this.gamePersistence.currentGameId.value) {
        debug('[GameBoard] Completing game on modal close');
        this.gamePersistence.completeGame(this.gameState);
      }
      // Navigate to game history to see the completed game
      this.$router.push('/history');
    },
    async handleDictionaryUpdate(selection) {
      // Ensure at least one is selected
      if (!selection.csw21 && !selection.nwl2023 && !selection.enable && !selection.slovenian) {
        alert('At least one dictionary must be selected');
        return;
      }
      
      this.selectedDictionaries = selection;
      
      try {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'update-dictionary',
            dictionaries: selection
          })
        });
        await this.fetchGameState();
      } catch (error) {
        console.error('Failed to update dictionary:', error);
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
  height: 100vh;
  width: 100vw;
  gap: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.board-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  min-width: 0;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 380px;
  height: 100vh;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow-y: auto; /* Changed from hidden to allow scrolling but not clip tooltips */
  overflow-x: visible;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 100; /* Ensure sidebar content is above board */
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
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  padding: 20px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.player-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  opacity: 0.6;
  position: relative;
  overflow: hidden;
}

.player-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}

.player-card:hover::before {
  transform: translateX(100%);
}

.player-card.player-1 {
  border-color: rgba(59, 130, 246, 0.3);
}

.player-card.player-2 {
  border-color: rgba(34, 197, 94, 0.3);
}

.player-card.player-3 {
  border-color: rgba(245, 158, 11, 0.3);
}

.player-card.player-4 {
  border-color: rgba(168, 85, 247, 0.3);
}

.player-badge {
  width: 50px;
  height: 50px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  transition: all 0.3s ease;
}

.player-card.player-1 .player-badge {
  background: rgba(59, 130, 246, 0.2);
}

.player-card.player-2 .player-badge {
  background: rgba(34, 197, 94, 0.2);
}

.player-card.player-3 .player-badge {
  background: rgba(245, 158, 11, 0.2);
}

.player-card.player-4 .player-badge {
  background: rgba(168, 85, 247, 0.2);
}

.player-info {
  flex: 1;
  text-align: left;
}

.player-card:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.player-card.active {
  opacity: 1;
  transform: scale(1.02);
}

.player-card.player-1.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.6);
  box-shadow: 
    0 0 30px rgba(59, 130, 246, 0.4),
    0 10px 25px rgba(0, 0, 0, 0.3);
}

.player-card.player-2.active {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.6);
  box-shadow: 
    0 0 30px rgba(34, 197, 94, 0.4),
    0 10px 25px rgba(0, 0, 0, 0.3);
}

.player-card.player-3.active {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.6);
  box-shadow: 
    0 0 30px rgba(245, 158, 11, 0.4),
    0 10px 25px rgba(0, 0, 0, 0.3);
}

.player-card.player-4.active {
  background: rgba(168, 85, 247, 0.2);
  border-color: rgba(168, 85, 247, 0.6);
  box-shadow: 
    0 0 30px rgba(168, 85, 247, 0.4),
    0 10px 25px rgba(0, 0, 0, 0.3);
}

.player-card.active .player-badge {
  animation: rotateBadge 3s linear infinite;
}

@keyframes rotateBadge {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.player-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: #a1a1aa;
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.player-card.active .player-name {
  color: #e4e4e7;
}

.player-score {
  font-size: 2rem;
  font-weight: 700;
  color: #e4e4e7;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

/* Tiles Remaining Counter */
.tiles-remaining {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.02);
  opacity: 0.7;
  transition: opacity 0.3s ease;
}

.tiles-remaining:hover {
  opacity: 1;
}

.tiles-icon {
  font-size: 1.2rem;
  opacity: 0.5;
}

.tiles-info {
  flex: 1;
}

.tiles-label {
  font-size: 0.7rem;
  font-weight: 500;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.tiles-count {
  font-size: 1.2rem;
  font-weight: 600;
  color: #a1a1aa;
  transition: color 0.3s ease;
}

/* Color gradient based on tiles remaining - more subtle */
.tiles-high .tiles-count {
  color: #86efac;
}

.tiles-medium .tiles-count {
  color: #fde047;
}

.tiles-low .tiles-count {
  color: #fdba74;
}

.tiles-critical .tiles-count {
  color: #fca5a5;
}

.history-section {
  flex: 1;
  padding: 20px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: visible; /* Allow tooltips to escape */
  position: relative;
  z-index: 1; /* Ensure proper stacking */
}

.history-section h3 {
  margin: 0 0 15px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 1px;
  flex-shrink: 0;
}

.history-table-wrapper {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  overflow-x: visible; /* Allow tooltips to extend outside */
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.history-table tbody tr {
  position: relative;
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
  position: relative;
  overflow: visible;
}

.word-with-definition {
  cursor: help;
  position: relative;
  padding-bottom: 1px;
  border-bottom: 1px dotted rgba(96, 165, 250, 0.5);
  transition: all 0.2s ease;
}

.word-with-definition:hover {
  color: #60a5fa;
  border-bottom-color: #60a5fa;
}

/* Enhanced tooltip styling - using fixed positioning to escape all containers */
.word-with-definition[title]:hover::after {
  content: attr(title);
  position: fixed;
  right: 30px; /* Fixed distance from right edge of viewport */
  left: auto;
  top: 50%; /* Center vertically */
  transform: translateY(-50%);
  padding: 12px 16px;
  background: rgba(20, 20, 35, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(96, 165, 250, 0.4);
  border-radius: 8px;
  color: #e4e4e7;
  font-size: 0.85rem;
  line-height: 1.5;
  font-weight: 400;
  text-transform: none;
  white-space: normal;
  max-width: 320px;
  min-width: 220px;
  z-index: 99999;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(96, 165, 250, 0.2);
  animation: tooltipFadeIn 0.2s ease-out;
  pointer-events: none;
}

.word-with-definition[title]:hover::before {
  content: '';
  position: fixed;
  right: 40px; /* Arrow positioned with tooltip */
  left: auto;
  top: 50%;
  transform: translateY(-50%) rotate(90deg);
  border: 7px solid transparent;
  border-top-color: rgba(96, 165, 250, 0.4);
  z-index: 99998;
  pointer-events: none;
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
