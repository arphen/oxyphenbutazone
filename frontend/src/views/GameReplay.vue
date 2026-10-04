<template>
  <div class="game-replay-view">
    <div v-if="!game" class="loading-state">
      <div class="loader">Loading game...</div>
    </div>

    <div v-else class="replay-container">
      <!-- Header -->
      <div class="replay-header">
        <button @click="goBack" class="back-button">
          ← Back to History
        </button>
        <div class="game-title">
          <h1>Game Analysis</h1>
          <div class="game-date">{{ formatDate(game.startedAt) }}</div>
        </div>
        <div class="spacer"></div>
      </div>

      <!-- Main Content -->
      <div class="replay-content">
        <!-- Board View -->
        <div class="board-section">
          <div class="board-container">
            <Board :key="currentMoveIndex" :board="currentBoardState" @cell-click="() => {}" />
          </div>

          <!-- Move Controls -->
          <div class="controls">
            <button 
              @click="firstMove" 
              :disabled="currentMoveIndex === 0"
              class="control-btn"
              title="First Move"
            >
              ⏮️
            </button>
            <button 
              @click="previousMove" 
              :disabled="currentMoveIndex === 0"
              class="control-btn"
              title="Previous Move"
            >
              ⏪
            </button>
            <div class="move-counter">
              Move {{ currentMoveIndex }} / {{ game.moves.length }}
            </div>
            <button 
              @click="nextMove" 
              :disabled="currentMoveIndex === game.moves.length"
              class="control-btn"
              title="Next Move"
            >
              ⏩
            </button>
            <button 
              @click="lastMove" 
              :disabled="currentMoveIndex === game.moves.length"
              class="control-btn"
              title="Last Move"
            >
              ⏭️
            </button>
          </div>

          <div class="move-slider">
            <input 
              type="range" 
              v-model.number="currentMoveIndex" 
              :min="0" 
              :max="game.moves.length"
              class="slider"
            />
          </div>
        </div>

        <!-- Sidebar -->
        <div class="sidebar">
          <!-- Current Game State Info -->
          <div class="state-info">
            <h3>Current State</h3>
            <div class="players-info">
              <div class="player-info" :class="{ active: currentState?.player1?.isCurrentPlayer }">
                <div class="player-header">
                  <span class="player-name">{{ game.metadata.player1Name || 'P1' }}</span>
                  <span class="player-score">{{ currentState?.player1?.score || 0 }}</span>
                </div>
                <div class="player-rack" v-if="showRacks && currentState?.player1?.rack">
                  <div 
                    v-for="(tile, index) in currentState.player1.rack" 
                    :key="index" 
                    class="rack-tile"
                  >
                    {{ (tile || '★').toUpperCase() }}
                  </div>
                </div>
              </div>

              <div class="player-info" :class="{ active: currentState?.player2?.isCurrentPlayer }">
                <div class="player-header">
                  <span class="player-name">{{ game.metadata.player2Name || 'P2' }}</span>
                  <span class="player-score">{{ currentState?.player2?.score || 0 }}</span>
                </div>
                <div class="player-rack" v-if="showRacks && currentState?.player2?.rack">
                  <div 
                    v-for="(tile, index) in currentState.player2.rack" 
                    :key="index" 
                    class="rack-tile"
                  >
                    {{ (tile || '★').toUpperCase() }}
                  </div>
                </div>
              </div>
            </div>
            <div class="view-options">
              <label>
                <input type="checkbox" v-model="showRacks" />
                Show Player Racks
              </label>
            </div>
          </div>

          <!-- Current Move Details -->
          <div class="move-details">
            <h3 v-if="currentMove">Move {{ currentMoveIndex }} Details</h3>
            <h3 v-else>Initial Position</h3>
            <div class="move-info" v-if="currentMove">
              <div class="info-row">
                <span class="label">Player:</span>
                <span class="value">{{ currentMove.playerId === '1' ? game.metadata.player1Name : game.metadata.player2Name }}</span>
              </div>
              <div class="info-row">
                <span class="label">Action:</span>
                <span class="value action-type" :class="[currentMove.action, { invalid: currentMove.valid === false }]">
                  {{ formatAction(currentMove.action) }}
                  <span v-if="currentMove.valid === false" class="invalid-badge">❌ Invalid</span>
                </span>
              </div>
              <div class="info-row" v-if="currentMove.message">
                <span class="label">Result:</span>
                <span class="value" :class="{ 'error-message': currentMove.valid === false }">
                  {{ currentMove.message }}
                </span>
              </div>
              <div class="info-row" v-if="currentMove.wordsFormed && currentMove.wordsFormed.length > 0">
                <span class="label">Words:</span>
                <span class="value words">
                  {{ currentMove.wordsFormed.map(w => w.word).join(', ').toUpperCase() }}
                </span>
              </div>
              <div class="info-row" v-if="currentMove.action === 'play-word'">
                <span class="label">Score:</span>
                <span class="value score" :class="{ positive: currentMove.scoreDelta > 0 }">
                  +{{ currentMove.scoreDelta }}
                </span>
              </div>
              <div class="info-row" v-if="currentMove.tilesPlaced && currentMove.tilesPlaced.length > 0">
                <span class="label">{{ currentMove.valid === false ? 'Attempted Tiles:' : 'Tiles Placed:' }}</span>
                <span class="value">
                  {{ formatTilesPlaced(currentMove.tilesPlaced) }}
                </span>
              </div>
              <div class="info-row" v-if="currentMove.action === 'exchange'">
                <span class="label">Tiles Exchanged:</span>
                <span class="value">{{ currentMove.tilesExchanged }}</span>
              </div>
              <div class="info-row">
                <span class="label">Time:</span>
                <span class="value">{{ formatTime(currentMove.timestamp) }}</span>
              </div>
            </div>
            <div v-else class="no-move-message">
              This is the starting position of the game before any moves were made.
            </div>
            
            <!-- Move Analysis Section -->
            <div v-if="currentMove && currentMove.action === 'play-word'" class="move-analysis-section">
              <div class="analysis-note">
                <strong>Note:</strong> Move analysis is currently in development. 
                Full analysis requires backend support to validate moves and compute scores.
              </div>
              
              <button 
                @click="analyzeCurrentMove" 
                class="analyze-button"
                :disabled="moveAnalysis?.analyzing.value"
              >
                <span v-if="moveAnalysis?.analyzing.value">Analyzing...</span>
                <span v-else>🔍 Analyze Move (Beta)</span>
              </button>
              
              <div v-if="currentMoveAnalysis" class="analysis-results">
                <h4>Move Analysis</h4>
                <div class="analysis-rating" :class="currentMoveAnalysis.rating.toLowerCase()">
                  Rating: {{ currentMoveAnalysis.rating }}
                </div>
                <div class="analysis-detail">
                  <span class="label">Your Score:</span>
                  <span class="value">{{ currentMoveAnalysis.playedScore }}</span>
                </div>
                <div class="analysis-detail" v-if="currentMoveAnalysis.bestScore">
                  <span class="label">Best Possible:</span>
                  <span class="value">{{ currentMoveAnalysis.bestScore }}</span>
                </div>
                <div class="analysis-detail" v-if="currentMoveAnalysis.scoreDiff > 0">
                  <span class="label">Could Gain:</span>
                  <span class="value improvement">+{{ currentMoveAnalysis.scoreDiff }}</span>
                </div>
                <div class="analysis-message">
                  {{ currentMoveAnalysis.message }}
                </div>
                <div v-if="currentMoveAnalysis.bestMove && currentMoveAnalysis.bestMove.found" class="best-move-details">
                  <h5>Best Move:</h5>
                  <div>{{ currentMoveAnalysis.bestMove.word }} at ({{ currentMoveAnalysis.bestMove.row }}, {{ currentMoveAnalysis.bestMove.col }})</div>
                </div>
              </div>
            </div>
            
            <!-- Debug Info -->
            <div v-if="currentMove" class="debug-info" style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.05); font-size: 0.75rem;">
              <details>
                <summary style="cursor: pointer;">Debug: Raw Move Data</summary>
                <pre style="overflow-x: auto; white-space: pre-wrap;">{{ JSON.stringify(currentMove, null, 2) }}</pre>
              </details>
            </div>
          </div>

          <!-- Move History -->
          <div class="move-history">
            <h3>Move History</h3>
            <div class="history-list">
              <div 
                v-for="(move, index) in game.moves" 
                :key="index"
                class="history-item"
                :class="{ active: index + 1 === currentMoveIndex, [move.action]: true }"
                @click="goToMove(index + 1)"
              >
                <div class="history-move-number">{{ index + 1 }}</div>
                <div class="history-move-info">
                  <div class="history-player">
                    {{ move.playerId === '1' ? game.metadata.player1Name || 'P1' : game.metadata.player2Name || 'P2' }}
                  </div>
                  <div class="history-action">
                    <span v-if="move.action === 'play-word' && move.wordsFormed && move.wordsFormed.length > 0">
                      {{ move.wordsFormed.map(w => w.word).join(', ').toUpperCase() }}
                    </span>
                    <span v-else-if="move.action === 'pass'">Passed</span>
                    <span v-else-if="move.action === 'exchange'">Exchanged {{ move.tilesExchanged }}</span>
                    <span v-else>{{ formatAction(move.action) }}</span>
                  </div>
                </div>
                <div class="history-score" v-if="move.action === 'play-word'">
                  +{{ move.scoreDelta }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Board from '../components/Board.vue';
import { useGamePersistence } from '../composables/useGamePersistence.js';
import { useMoveAnalysis } from '../composables/useMoveAnalysis.js';
import { debug, logWarn, logError } from '../utils/log';

export default {
  name: 'GameReplay',
  components: {
    Board
  },
  data() {
    return {
      game: null,
      gamePersistence: null,
      moveAnalysis: null,
      currentMoveIndex: 0,
      showRacks: false,
      showAnalysis: false,
      moveAnalysisResults: {} // Cache analysis results by move index
    };
  },
  computed: {
    currentState() {
      if (!this.game) return null;
      
      if (this.currentMoveIndex === 0) {
        debug('[GameReplay] Showing initial state');
        return this.game.initialState;
      }
      
      const move = this.game.moves[this.currentMoveIndex - 1];
      if (!move) {
        logWarn('[GameReplay] Move not found at index', this.currentMoveIndex - 1);
        return this.game.initialState;
      }
      
      debug('[GameReplay] Current move:', {
        index: this.currentMoveIndex,
        move,
        hasSnapshot: !!move.gameStateSnapshot
      });
      
      // Check if gameStateSnapshot exists
      if (!move.gameStateSnapshot) {
        logWarn('[GameReplay] Move has no gameStateSnapshot, reconstructing:', move);
        // Fallback: try to reconstruct state from move data
        return this.reconstructStateFromMove(move);
      }
      
      debug('[GameReplay] Using gameStateSnapshot');
      return move.gameStateSnapshot;
    },
    currentBoardState() {
      // For invalid moves, show the board with attempted tiles
      if (this.currentMove && this.currentMove.valid === false && this.currentMove.boardStateBefore) {
        return this.currentMove.boardStateBefore;
      }
      
      const board = this.currentState?.board;
      if (!board || board.length === 0) {
        logWarn('[GameReplay] No board state available');
        return this.game?.initialState?.board || [];
      }
      return board;
    },
    currentMove() {
      if (this.currentMoveIndex === 0) return null;
      return this.game.moves[this.currentMoveIndex - 1];
    },
    currentMoveAnalysis() {
      return this.moveAnalysisResults[this.currentMoveIndex] || null;
    }
  },
  watch: {
    currentMoveIndex(newIndex, oldIndex) {
      debug('[GameReplay] Move index changed:', { from: oldIndex, to: newIndex });
      debug('[GameReplay] Current move:', this.currentMove);
      debug('[GameReplay] Current state:', this.currentState);
    }
  },
  mounted() {
    this.gamePersistence = useGamePersistence();
    this.moveAnalysis = useMoveAnalysis();
    this.loadGame();
  },
  methods: {
    async analyzeCurrentMove() {
      if (!this.currentMove || this.currentMoveIndex === 0) {
        alert('No move to analyze. Select a move from the history.');
        return;
      }

      // Get the board state BEFORE this move
      const previousState = this.currentMoveIndex > 1 
        ? this.game.moves[this.currentMoveIndex - 2]?.gameStateSnapshot 
        : this.game.initialState;

      if (!previousState) {
        alert('Cannot analyze: missing board state before move');
        return;
      }

      const playerId = this.currentMove.playerId;
      const player = playerId === '1' ? previousState.player1 : previousState.player2;
      const rack = this.currentMove.rackBefore || player?.rack || [];

      if (rack.length === 0) {
        alert('Cannot analyze: rack data not available');
        return;
      }

      debug('[GameReplay] Analyzing move:', {
        moveIndex: this.currentMoveIndex,
        playerId,
        rack,
        boardState: previousState.board
      });

      const result = await this.moveAnalysis.analyzeMoveQuality(
        {
          score: this.currentMove.scoreDelta,
          tilesPlaced: this.currentMove.tilesPlaced,
          wordsFormed: this.currentMove.wordsFormed
        },
        rack,
        previousState.board,
        previousState
      );

      // Cache the result
      this.moveAnalysisResults[this.currentMoveIndex] = result;
      this.showAnalysis = true;
    },
    reconstructStateFromMove(move) {
      // For invalid moves, show the board with the attempted tiles (boardStateBefore)
      // For valid moves, show the board after the move (boardState)
      const boardToShow = (move.valid === false && move.boardStateBefore) 
        ? move.boardStateBefore 
        : move.boardState;
      
      // If move has boardState, use it
      if (boardToShow) {
        return {
          board: boardToShow,
          player1: {
            score: move.playerId === '1' ? move.scoreAfter : (move.scoreBefore || 0),
            rack: move.playerId === '1' ? move.rackAfter : (move.rackBefore || []),
            isCurrentPlayer: move.playerId !== '1'
          },
          player2: {
            score: move.playerId === '2' ? move.scoreAfter : (move.scoreBefore || 0),
            rack: move.playerId === '2' ? move.rackAfter : (move.rackBefore || []),
            isCurrentPlayer: move.playerId !== '2'
          },
          currentPlayer: move.playerId === '1' ? 2 : 1,
          message: move.message || null,
          gameOver: false
        };
      }
      
      logError('[GameReplay] Cannot reconstruct state from move:', move);
      return this.game.initialState;
    },
    
    loadGame() {
      const gameId = this.$route.params.gameId;
      this.game = this.gamePersistence.getGame(gameId);
      
      if (!this.game) {
        alert('Game not found');
        this.$router.push('/history');
        return;
      }
      
      debug('[GameReplay] Loaded game:', {
        id: this.game.id,
        moves: this.game.moves.length,
        hasInitialState: !!this.game.initialState,
        initialState: this.game.initialState,
        allMoves: this.game.moves,
        firstMove: this.game.moves[0]
      });
      
      // Start at the last move
      this.currentMoveIndex = this.game.moves.length;
      
      debug('[GameReplay] Set currentMoveIndex to:', this.currentMoveIndex);
    },
    goBack() {
      this.$router.push('/history');
    },
    firstMove() {
      this.currentMoveIndex = 0;
    },
    previousMove() {
      if (this.currentMoveIndex > 0) {
        this.currentMoveIndex--;
      }
    },
    nextMove() {
      if (this.currentMoveIndex < this.game.moves.length) {
        this.currentMoveIndex++;
      }
    },
    lastMove() {
      this.currentMoveIndex = this.game.moves.length;
    },
    goToMove(moveIndex) {
      this.currentMoveIndex = moveIndex;
    },
    formatAction(action) {
      const actions = {
        'play-word': 'Played Word',
        'pass': 'Passed Turn',
        'exchange': 'Exchanged Tiles',
        'recall': 'Recalled Tiles'
      };
      return actions[action] || action;
    },
    formatTilesPlaced(tiles) {
      return tiles.map(t => {
        const letter = t.isBlank ? `${t.chosenLetter}★` : t.letter;
        return `${letter.toUpperCase()}(${t.row},${t.col})`;
      }).join(', ');
    },
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
    }
  }
};
</script>

<style scoped>
.game-replay-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #e4e4e7;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.loader {
  font-size: 1.5rem;
  color: #a1a1aa;
}

.replay-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.replay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.back-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e4e4e7;
  padding: 10px 20px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  font-weight: 600;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.game-title {
  text-align: center;
}

.game-title h1 {
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 5px;
}

.game-date {
  font-size: 0.9rem;
  color: #a1a1aa;
}

.spacer {
  width: 150px;
}

.replay-content {
  display: flex;
  flex: 1;
}

.board-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  gap: 20px;
  overflow-y: auto;
}

.board-container {
  width: 100%;
  max-width: min(600px, 90vw);
  aspect-ratio: 1;
}

.board-container :deep(.board) {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
}

.controls {
  display: flex;
  align-items: center;
  gap: 15px;
  background: rgba(255, 255, 255, 0.05);
  padding: 15px 25px;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.control-btn {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  color: #93c5fd;
  padding: 10px 15px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.control-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.control-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.move-counter {
  font-size: 1.1rem;
  font-weight: 600;
  color: #e4e4e7;
  min-width: 120px;
  text-align: center;
}

.move-slider {
  width: 100%;
  max-width: 600px;
}

.slider {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
  cursor: pointer;
  border-radius: 4px;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: #3b82f6;
  cursor: pointer;
  border-radius: 50%;
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #3b82f6;
  cursor: pointer;
  border-radius: 50%;
  border: none;
}

.sidebar {
  width: 400px;
  min-width: 400px;
  background: rgba(0, 0, 0, 0.3);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: calc(100vh - 80px);
}

.state-info,
.move-details,
.move-history {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.state-info h3,
.move-details h3,
.move-history h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 15px;
}

.players-info {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 15px;
}

.player-info {
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.player-info.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.player-name {
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.player-score {
  font-size: 1.5rem;
  font-weight: 700;
}

.player-rack {
  display: flex;
  gap: 5px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.rack-tile {
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 10px;
  font-weight: 600;
  font-size: 0.85rem;
  min-width: 30px;
  text-align: center;
}

.view-options {
  margin-top: 10px;
}

.view-options label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  cursor: pointer;
}

.view-options input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.move-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-row .label {
  font-size: 0.85rem;
  color: #a1a1aa;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-row .value {
  font-size: 0.95rem;
  color: #e4e4e7;
  text-align: right;
  max-width: 60%;
}

.value.action-type {
  font-weight: 600;
}

.value.action-type.play-word {
  color: #86efac;
}

.value.action-type.pass {
  color: #fde047;
}

.value.action-type.exchange {
  color: #c084fc;
}

.value.action-type.invalid {
  color: #f87171;
}

.invalid-badge {
  display: inline-block;
  margin-left: 8px;
  font-size: 0.85em;
}

.error-message {
  color: #f87171;
  font-style: italic;
}

.value.words {
  font-weight: 700;
  color: #93c5fd;
}

.value.score.positive {
  color: #86efac;
  font-weight: 700;
  font-size: 1.2rem;
}

.no-move-message {
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  color: #a1a1aa;
  font-style: italic;
  text-align: center;
}

.move-analysis-section {
  margin-top: 20px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.analysis-note {
  padding: 10px;
  background: rgba(59, 130, 246, 0.1);
  border-left: 3px solid #3b82f6;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #93c5fd;
  margin-bottom: 10px;
  line-height: 1.4;
}

.analysis-note strong {
  color: #bfdbfe;
}

.analyze-button {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.analyze-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.analyze-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.analysis-results {
  margin-top: 15px;
  padding: 15px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.analysis-results h4 {
  margin-bottom: 10px;
  color: #e4e4e7;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.analysis-rating {
  padding: 8px 12px;
  border-radius: 4px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 10px;
}

.analysis-rating.excellent {
  background: rgba(134, 239, 172, 0.2);
  color: #86efac;
  border: 1px solid rgba(134, 239, 172, 0.3);
}

.analysis-rating.good {
  background: rgba(147, 197, 253, 0.2);
  color: #93c5fd;
  border: 1px solid rgba(147, 197, 253, 0.3);
}

.analysis-rating.okay {
  background: rgba(253, 224, 71, 0.2);
  color: #fde047;
  border: 1px solid rgba(253, 224, 71, 0.3);
}

.analysis-rating.weak {
  background: rgba(248, 113, 113, 0.2);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.analysis-detail {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 0.9rem;
}

.analysis-detail .label {
  color: #a1a1aa;
}

.analysis-detail .value {
  color: #e4e4e7;
  font-weight: 600;
}

.analysis-detail .value.improvement {
  color: #86efac;
}

.analysis-message {
  margin-top: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 0.85rem;
  color: #d4d4d8;
  font-style: italic;
}

.best-move-details {
  margin-top: 10px;
  padding: 10px;
  background: rgba(59, 130, 246, 0.1);
  border-left: 3px solid #3b82f6;
  border-radius: 4px;
}

.best-move-details h5 {
  margin-bottom: 5px;
  color: #93c5fd;
  font-size: 0.85rem;
}

.best-move-details div {
  color: #e4e4e7;
  font-size: 0.9rem;
}

.move-history {
  flex: 1;
  min-height: 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 400px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.history-item.active {
  background: rgba(59, 130, 246, 0.2);
  border-left-color: #3b82f6;
}

.history-item.play-word {
  border-left-color: rgba(134, 239, 172, 0.3);
}

.history-item.pass {
  border-left-color: rgba(253, 224, 71, 0.3);
  opacity: 0.7;
}

.history-item.exchange {
  border-left-color: rgba(192, 132, 252, 0.3);
  opacity: 0.8;
}

.history-move-number {
  font-weight: 700;
  color: #a1a1aa;
  min-width: 30px;
}

.history-move-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-player {
  font-size: 0.75rem;
  color: #a1a1aa;
  font-weight: 600;
  text-transform: uppercase;
}

.history-action {
  font-size: 0.85rem;
  color: #e4e4e7;
}

.invalid-move-text {
  color: #f87171;
  font-style: italic;
}

.history-score {
  font-weight: 700;
  color: #86efac;
  font-size: 0.9rem;
}

@media (max-width: 1024px) {
  .sidebar {
    width: 350px;
    min-width: 350px;
  }
  
  .board-container {
    max-width: min(500px, 85vw);
  }
}

@media (max-width: 768px) {
  .replay-content {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    min-width: unset;
    max-height: unset;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .board-section {
    min-height: 50vh;
  }
  
  .board-container {
    max-width: min(500px, 95vw);
  }

  .spacer {
    display: none;
  }
  
  .replay-header {
    flex-wrap: wrap;
    gap: 10px;
  }
}
</style>
