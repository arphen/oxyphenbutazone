<template>
  <div class="mobile-rack-view">
    <!-- Debug Console Overlay -->
    <div v-if="showDebugConsole" class="debug-console">
      <div class="debug-header">
        <span>🐛 Debug Console</span>
        <button @click="showDebugConsole = false" class="close-debug">✕</button>
        <button @click="debugLogs = []" class="clear-debug">Clear</button>
      </div>
      <div class="debug-logs">
        <div v-for="(log, index) in debugLogs" :key="index" :class="['debug-log', log.type]">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
    <button v-else @click="showDebugConsole = true" class="debug-toggle">🐛</button>
    
    <div class="rack-container">
      <div class="refresh-info">
        <p>💡 Drag tiles from your rack onto the board</p>
        <p class="connection-status" :class="{ connected: isConnected }">
          {{ isConnected ? '🟢 Connected' : '🔴 Connecting...' }}
        </p>
      </div>
      
      <div class="rack-header">
        <div class="player-info">
          <span class="player-name">{{ playerName }}</span>
          <span class="score-value">{{ score }}</span>
        </div>
        <div :class="['turn-status', { active: isCurrentPlayer }]">
          {{ isCurrentPlayer ? '🟢' : '⏸️' }}
        </div>
      </div>
      
      <!-- Mini Board View (7x7) -->
      <div class="mini-board-section">
        <p class="board-label">📍 Board View</p>
        <div class="mini-board">
          <div v-for="(row, rowIndex) in getVisibleBoard()" :key="rowIndex" class="board-row">
            <div
              v-for="(square, colIndex) in row"
              :key="colIndex"
              :class="getSquareClass(square)"
              :data-board-row="square.actualRow"
              :data-board-col="square.actualCol"
              class="board-square drop-zone"
            >
              <span v-if="square.letter || square.isBlank" class="board-letter" :class="{ locked: square.locked, blank: square.isBlank }">
                {{ square.isBlank ? (square.chosenLetter || '★').toUpperCase() : square.letter.toUpperCase() }}
                <span class="letter-points">{{ getLetterValue(square.isBlank ? square.chosenLetter : square.letter) }}</span>
                <span v-if="square.isBlank" class="blank-indicator">★</span>
              </span>
              <span v-else-if="square.type !== 'out-of-bounds'" class="square-label">
                {{ square.type === 'tw' ? 'TW' : square.type === 'dw' ? 'DW' : square.type === 'tl' ? 'TL' : square.type === 'dl' ? 'DL' : square.type === 'center' ? '★' : '' }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="tiles">
        <div 
          v-for="(letter, index) in rack" 
          :key="index" 
          class="tile"
          :class="{ dragging: draggedIndex === index && isDragging, 'blank-tile': letter === '' }"
          :data-index="index"
          :data-letter="letter"
          @touchstart="onTileTouchStart($event, letter, index)"
          @touchmove.prevent="onTouchMove"
          @touchend="onTouchEnd"
        >
          <span class="letter">{{ (letter || '★').toUpperCase() }}</span>
          <span class="value">{{ getLetterValue(letter) }}</span>
        </div>
      </div>
      
      <!-- Ghost tile that follows finger during drag -->
      <div v-if="isDragging" class="ghost-tile" :style="ghostTileStyle">
        {{ (draggedLetter || '★').toUpperCase() }}
        <span class="ghost-value">{{ getLetterValue(draggedLetter) }}</span>
      </div>
      
      <!-- Action Buttons -->
      <div class="action-buttons">
        <button 
          class="action-btn play-btn" 
          @click="playWord" 
          :disabled="!isCurrentPlayer || !hasNewTiles"
        >
          <span class="btn-icon">▶️</span>
          <span class="btn-label">Play</span>
        </button>
        <button 
          class="action-btn recall-btn" 
          @click="recallTiles"
          :disabled="!hasNewTiles"
        >
          <span class="btn-icon">↩️</span>
          <span class="btn-label">Recall</span>
        </button>
        <button 
          class="action-btn pass-btn" 
          @click="passTurn"
          :disabled="!isCurrentPlayer || hasNewTiles"
        >
          <span class="btn-icon">⏭️</span>
          <span class="btn-label">Pass</span>
        </button>
        <button 
          class="action-btn exchange-btn" 
          @click="exchangeTiles"
          :disabled="!isCurrentPlayer"
        >
          <span class="btn-icon">🔄</span>
          <span class="btn-label">Swap</span>
        </button>
      </div>
      
      <div class="message-box" v-if="gameState?.message" :class="gameState?.messageType">
        {{ gameState.message }}
      </div>
    </div>
    
    <!-- Game Over Modal -->
    <GameOverModal
      :show="gameState?.gameOver || false"
      :winner="gameState?.winner"
      :finalScore1="gameState?.finalScores?.player1 || 0"
      :finalScore2="gameState?.finalScores?.player2 || 0"
      :gameScore1="gameState?.player1?.score || 0"
      :gameScore2="gameState?.player2?.score || 0"
      :remaining1="gameState?.finalScores?.player1Remaining || 0"
      :remaining2="gameState?.finalScores?.player2Remaining || 0"
      @new-game="restartGame"
      @close="() => {}"
    />
    
    <!-- Blank Letter Picker -->
    <BlankLetterPicker
      v-if="showBlankPicker"
      @select="handleBlankLetterSelect"
      @cancel="showBlankPicker = false"
    />
  </div>
</template>

<script>
import GameOverModal from '../components/GameOverModal.vue';
import BlankLetterPicker from '../components/BlankLetterPicker.vue';

export default {
  name: 'PlayerRackView',
  components: {
    GameOverModal,
    BlankLetterPicker,
  },
  props: {
    playerId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      gameState: null,
      isConnected: false,
      pollInterval: null,
      // Touch-based drag state
      isDragging: false,
      draggedLetter: null,
      draggedIndex: null,
      touchStartX: 0,
      touchStartY: 0,
      currentTouchX: 0,
      currentTouchY: 0,
      draggedElement: null,
      dropTarget: null,
      dragStartTime: null,
      // Drag intent detection
      dragIntent: null, // 'reorder', 'place', or null
      dragThreshold: 15, // pixels to move before determining intent
      // Blank tile handling
      showBlankPicker: false,
      pendingBlankPosition: null, // { row, col }
      // Debug console
      showDebugConsole: false,
      debugLogs: []
    };
  },
  computed: {
    playerName() {
      if (!this.gameState) return '';
      const player = this.playerId === '1' ? this.gameState.player1 : this.gameState.player2;
      return player?.playerName || '';
    },
    rack() {
      if (!this.gameState) return [];
      const player = this.playerId === '1' ? this.gameState.player1 : this.gameState.player2;
      return player?.rack || [];
    },
    score() {
      if (!this.gameState) return 0;
      const player = this.playerId === '1' ? this.gameState.player1 : this.gameState.player2;
      return player?.score || 0;
    },
    isCurrentPlayer() {
      if (!this.gameState) return false;
      const player = this.playerId === '1' ? this.gameState.player1 : this.gameState.player2;
      return player?.isCurrentPlayer || false;
    },
    board() {
      return this.gameState?.board || [];
    },
    viewportCenter() {
      return this.gameState?.viewportCenter || { row: 7, col: 7 };
    },
    ghostTileStyle() {
      if (!this.isDragging) return {};
      return {
        position: 'fixed',
        left: `${this.currentTouchX - 25}px`,
        top: `${this.currentTouchY - 25}px`,
        width: '50px',
        height: '50px',
        pointerEvents: 'none',
        zIndex: 9999
      };
    },
    hasNewTiles() {
      if (!this.board || this.board.length === 0) return false;
      
      for (let row = 0; row < this.board.length; row++) {
        for (let col = 0; col < this.board[row].length; col++) {
          if (this.board[row][col].isNew) {
            return true;
          }
        }
      }
      return false;
    }
  },
  mounted() {
    // Override console for debug logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
      this.addDebugLog('log', args.join(' '));
      originalLog.apply(console, args);
    };
    
    console.error = (...args) => {
      this.addDebugLog('error', args.join(' '));
      originalError.apply(console, args);
    };
    
    console.warn = (...args) => {
      this.addDebugLog('warn', args.join(' '));
      originalWarn.apply(console, args);
    };
    
    this.fetchGameState();
    this.pollInterval = setInterval(() => {
      this.fetchGameState();
    }, 500);
  },
  beforeUnmount() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  },
  methods: {
    addDebugLog(type, message) {
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      this.debugLogs.push({ type, message, time });
      if (this.debugLogs.length > 50) {
        this.debugLogs.shift();
      }
    },
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
      return values[letter?.toLowerCase()] || 0;
    },
    async fetchGameState() {
      try {
        const response = await fetch('/api/game-state');
        if (response.ok) {
          this.gameState = await response.json();
          this.isConnected = true;
        } else {
          this.isConnected = false;
        }
      } catch (error) {
        console.error('Error fetching game state:', error);
        this.isConnected = false;
      }
    },
    getVisibleBoard() {
      if (!this.board || this.board.length === 0) return [];
      
      const result = [];
      for (let i = 0; i < 7; i++) {
        const row = [];
        for (let j = 0; j < 7; j++) {
          const boardRow = this.viewportCenter.row - 3 + i;
          const boardCol = this.viewportCenter.col - 3 + j;
          
          if (boardRow >= 0 && boardRow < 15 && boardCol >= 0 && boardCol < 15) {
            row.push({
              ...this.board[boardRow][boardCol],
              actualRow: boardRow,
              actualCol: boardCol
            });
          } else {
            row.push({ type: 'out-of-bounds', letter: null, locked: true });
          }
        }
        result.push(row);
      }
      return result;
    },
    onTileTouchStart(event, letter, index) {
      const touch = event.touches[0];
      this.isDragging = true;
      this.draggedLetter = letter;
      this.draggedIndex = index;
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.currentTouchX = touch.clientX;
      this.currentTouchY = touch.clientY;
      this.dragStartTime = Date.now();
      this.dragIntent = null; // Reset intent
      this.draggedElement = event.target.closest('.tile');
      
      console.log(`[Drag Start] Index: ${index}, Letter: ${letter || 'BLANK'}`);
    },
    onTouchMove(event) {
      if (!this.isDragging) return;
      
      const touch = event.touches[0];
      this.currentTouchX = touch.clientX;
      this.currentTouchY = touch.clientY;
      
      // Determine drag intent if not yet determined
      if (!this.dragIntent) {
        const deltaX = Math.abs(this.currentTouchX - this.touchStartX);
        const deltaY = Math.abs(this.currentTouchY - this.touchStartY);
        const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (totalDistance > this.dragThreshold) {
          // Check what's under the current touch position
          const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
          const rackTile = elementUnderTouch?.closest('.tile');
          const boardSquare = elementUnderTouch?.closest('.drop-zone');
          
          // If we're over another rack tile, it's likely a reorder
          // If we moved significantly upward (toward board), it's likely a place
          if (rackTile && rackTile !== this.draggedElement) {
            this.dragIntent = 'reorder';
            console.log('[Drag Intent] REORDER detected');
          } else if (deltaY > this.dragThreshold && deltaY > deltaX) {
            // Moving upward more than horizontally - likely placing on board
            this.dragIntent = 'place';
            console.log('[Drag Intent] PLACE detected (upward movement)');
          } else if (boardSquare) {
            this.dragIntent = 'place';
            console.log('[Drag Intent] PLACE detected (over board)');
          } else {
            // Default to reorder if moving horizontally within rack area
            this.dragIntent = 'reorder';
            console.log('[Drag Intent] REORDER detected (horizontal movement)');
          }
        }
      }
      
      // Update drop target highlighting
      const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
      
      if (this.dropTarget) {
        this.dropTarget.classList.remove('drop-target-active');
        this.dropTarget.classList.remove('reorder-target');
      }
      
      if (elementUnderTouch) {
        if (this.dragIntent === 'reorder') {
          // Only highlight rack tiles for reorder
          const rackTile = elementUnderTouch.closest('.tile');
          if (rackTile && rackTile !== this.draggedElement) {
            this.dropTarget = rackTile;
            rackTile.classList.add('reorder-target');
          }
        } else if (this.dragIntent === 'place') {
          // Only highlight board squares for placement
          const boardSquare = elementUnderTouch.closest('.drop-zone');
          if (boardSquare) {
            this.dropTarget = boardSquare;
            boardSquare.classList.add('drop-target-active');
          }
        } else {
          // Intent not determined yet - highlight both possibilities
          const dropZone = elementUnderTouch.closest('.drop-zone, .tile');
          if (dropZone && dropZone !== this.draggedElement) {
            this.dropTarget = dropZone;
            if (dropZone.classList.contains('tile')) {
              dropZone.classList.add('reorder-target');
            } else {
              dropZone.classList.add('drop-target-active');
            }
          }
        }
      }
    },
    async onTouchEnd(event) {
      if (!this.isDragging) return;
      
      const touch = event.changedTouches[0];
      const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // Clean up drop target highlighting
      if (this.dropTarget) {
        this.dropTarget.classList.remove('drop-target-active');
        this.dropTarget.classList.remove('reorder-target');
      }
      
      const dragDuration = Date.now() - this.dragStartTime;
      console.log(`[Drag End] Duration: ${dragDuration}ms, Intent: ${this.dragIntent || 'undetermined'}`);
      
      if (elementUnderTouch) {
        // Handle reordering within rack
        const rackTile = elementUnderTouch.closest('.tile');
        if (rackTile && rackTile !== this.draggedElement && this.dragIntent === 'reorder') {
          const targetIndex = parseInt(rackTile.dataset.index);
          if (!isNaN(targetIndex) && this.draggedIndex !== targetIndex) {
            console.log(`[Reorder] Moving tile from index ${this.draggedIndex} to ${targetIndex}`);
            
            // Reorder tiles in rack
            const newRack = [...this.rack];
            const [draggedItem] = newRack.splice(this.draggedIndex, 1);
            newRack.splice(targetIndex, 0, draggedItem);
            
            // Update the rack in the game state
            const player = this.playerId === '1' ? 'player1' : 'player2';
            this.gameState[player].rack = newRack;
            
            console.log(`[Reorder] New rack order:`, newRack);
          }
        }
        
        // Handle placing tile on board
        const boardSquare = elementUnderTouch.closest('.drop-zone');
        if (boardSquare && this.isCurrentPlayer && (this.dragIntent === 'place' || !this.dragIntent)) {
          const row = parseInt(boardSquare.dataset.boardRow);
          const col = parseInt(boardSquare.dataset.boardCol);
          
          if (!isNaN(row) && !isNaN(col)) {
            const visibleBoard = this.getVisibleBoard();
            
            for (const rowArray of visibleBoard) {
              for (const square of rowArray) {
                if (square.actualRow === row && square.actualCol === col) {
                  const isEmpty = !square.letter || square.letter === '';
                  const isNotLocked = !square.locked;
                  const isNotOutOfBounds = square.type !== 'out-of-bounds';
                  
                  if (isEmpty && isNotLocked && isNotOutOfBounds) {
                    console.log(`[Place] Placing tile at (${row}, ${col})`);
                    
                    // Check if it's a blank tile
                    if (this.draggedLetter === '') {
                      // Show blank picker and store position
                      this.pendingBlankPosition = { row, col, rackIndex: this.draggedIndex };
                      this.showBlankPicker = true;
                    } else {
                      // Place regular tile
                      try {
                        const response = await fetch('/api/action', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'place-tile',
                            playerId: this.playerId,
                            letter: this.draggedLetter,
                            rackIndex: this.draggedIndex,
                            row: row,
                            col: col
                          })
                        });
                        
                        if (response.ok) {
                          const result = await response.json();
                          this.gameState = result.gameState;
                          console.log('[Place] Tile placed successfully');
                        }
                      } catch (error) {
                        console.error('Failed to place tile:', error);
                      }
                    }
                  }
                  break;
                }
              }
            }
          }
        }
      }
      
      // Reset drag state
      this.isDragging = false;
      this.draggedLetter = null;
      this.draggedIndex = null;
      this.draggedElement = null;
      this.dropTarget = null;
      this.dragIntent = null;
    },
    getSquareClass(square) {
      const classes = ['board-square'];
      if (square.type === 'out-of-bounds') {
        classes.push('out-of-bounds');
      } else if (square.type) {
        classes.push(square.type);
      }
      if (square.locked) {
        classes.push('locked');
      }
      return classes.join(' ');
    },
    async playWord() {
      if (!this.isCurrentPlayer || !this.hasNewTiles) return;
      
      try {
        const response = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'play-word',
            playerId: this.playerId
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          this.gameState = result.gameState;
        }
      } catch (error) {
        console.error('Failed to play word:', error);
      }
    },
    async recallTiles() {
      if (!this.hasNewTiles) return;
      
      try {
        const response = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'recall',
            playerId: this.playerId
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          this.gameState = result.gameState;
        }
      } catch (error) {
        console.error('Failed to recall tiles:', error);
      }
    },
    async passTurn() {
      if (!this.isCurrentPlayer || this.hasNewTiles) return;
      
      try {
        const response = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'pass',
            playerId: this.playerId
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
    async exchangeTiles() {
      if (!this.isCurrentPlayer) return;
      alert('Exchange functionality coming soon!');
    },
    async handleBlankLetterSelect(chosenLetter) {
      if (!this.pendingBlankPosition) return;
      
      const { row, col, rackIndex } = this.pendingBlankPosition;
      
      try {
        // Place blank tile with chosen letter
        const response = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'place-tile',
            playerId: this.playerId,
            letter: '',
            rackIndex: rackIndex,
            row: row,
            col: col,
            chosenLetter: chosenLetter
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          this.gameState = result.gameState;
        }
      } catch (error) {
        console.error('Failed to place blank tile:', error);
      } finally {
        this.showBlankPicker = false;
        this.pendingBlankPosition = null;
      }
    },
    async restartGame() {
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
    }
  }
};
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.mobile-rack-view {
  font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
  min-height: -webkit-fill-available;
  height: 100vh;
  height: -webkit-fill-available;
  width: 100vw;
  padding: max(15px, env(safe-area-inset-top)) max(15px, env(safe-area-inset-right)) max(15px, env(safe-area-inset-bottom)) max(15px, env(safe-area-inset-left));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.debug-console {
  position: fixed;
  top: 10px;
  left: 10px;
  right: 10px;
  bottom: 10px;
  background: rgba(10, 10, 20, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.8);
}

.debug-header {
  padding: 15px;
  background: rgba(0, 0, 0, 0.3);
  color: #e4e4e7;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 12px 12px 0 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.close-debug,
.clear-debug {
  background: rgba(255, 255, 255, 0.1);
  color: #e4e4e7;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 6px 12px;
  border-radius: 6px;
  margin-left: 10px;
  font-size: 0.85rem;
  font-weight: 600;
}

.debug-logs {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
}

.debug-log {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: #a1a1aa;
}

.debug-log.error {
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
}

.debug-log.warn {
  background: rgba(251, 146, 60, 0.1);
  color: #fdba74;
}

.log-time {
  font-weight: bold;
  margin-right: 10px;
  color: #71717a;
}

.debug-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e4e4e7;
  font-size: 24px;
  cursor: pointer;
  z-index: 9000;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}

.rack-container {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 20px;
  max-width: 500px;
  width: calc(100% - 30px);
  max-height: calc(100vh - 30px);
  max-height: calc(-webkit-fill-available - 30px);
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.refresh-info {
  text-align: center;
  margin-bottom: 15px;
  font-size: 0.85rem;
  color: #a1a1aa;
}

.connection-status {
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
  display: inline-block;
  margin-top: 5px;
  background: rgba(251, 146, 60, 0.2);
  color: #fdba74;
  border: 1px solid rgba(251, 146, 60, 0.3);
  font-size: 0.75rem;
}

.connection-status.connected {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.3);
}

.rack-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.player-info {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.player-name {
  font-size: 1.1rem;
  color: #a1a1aa;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.score-value {
  font-size: 1.5rem;
  color: #60a5fa;
  font-weight: 700;
}

.turn-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 1.2rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.turn-status.active {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.4);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.mini-board-section {
  margin-bottom: 20px;
}

.board-label {
  text-align: center;
  font-weight: 600;
  color: #a1a1aa;
  margin-bottom: 10px;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mini-board {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: rgba(0, 0, 0, 0.4);
  padding: 5px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.board-row {
  display: flex;
  gap: 2px;
}

.board-square {
  position: relative;
  width: calc((100%) / 7);
  aspect-ratio: 1;
  background: rgba(30, 30, 50, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: bold;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

/* Colorblind-friendly colors matching desktop */
.board-square.tw { background: rgba(219, 39, 119, 0.35); color: #f9a8d4; }
.board-square.dw { background: rgba(244, 114, 182, 0.25); color: #fbcfe8; }
.board-square.tl { background: rgba(37, 99, 235, 0.35); color: #93c5fd; }
.board-square.dl { background: rgba(125, 211, 252, 0.25); color: #bfdbfe; }
.board-square.center { background: rgba(236, 72, 153, 0.3); color: #f9a8d4; }
.board-square.out-of-bounds { background: rgba(20, 20, 30, 0.8); }
.board-square.locked { background: rgba(40, 40, 60, 0.6); }

.board-square.drop-target-active {
  box-shadow: 0 0 0 2px #86efac;
  background: rgba(34, 197, 94, 0.3);
}

.tile.reorder-target {
  box-shadow: 0 0 0 3px #60a5fa;
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.3), rgba(59, 130, 246, 0.3));
  transform: scale(1.1);
  transition: all 0.15s ease;
}

.board-letter {
  font-size: 1rem;
  font-weight: 800;
  color: #e4e4e7;
  position: relative;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.board-letter.blank {
  color: #fbbf24;
  text-transform: lowercase;
}

.blank-indicator {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 0.6rem;
  color: #fbbf24;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.letter-points {
  position: absolute;
  bottom: -6px;
  right: -6px;
  font-size: 0.5rem;
  color: #a1a1aa;
}

.square-label {
  font-size: 0.55rem;
  opacity: 0.7;
}

.tiles {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.tile {
  position: relative;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, rgba(254, 240, 138, 0.9), rgba(252, 211, 77, 0.9));
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  touch-action: none;
  cursor: grab;
  border: 1px solid rgba(161, 98, 7, 0.3);
}

.tile.dragging {
  opacity: 0.5;
}

.tile .letter {
  font-size: 1.4rem;
  font-weight: 800;
  color: #1a1a2e;
}

.tile.blank-tile {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.9), rgba(226, 232, 240, 0.9));
  border-color: rgba(100, 116, 139, 0.4);
}

.tile.blank-tile .letter {
  color: #fbbf24;
  font-size: 1.8rem;
}

.tile .value {
  position: absolute;
  bottom: 3px;
  right: 5px;
  font-size: 0.65rem;
  color: #52525b;
  font-weight: 600;
}

.ghost-tile {
  background: linear-gradient(135deg, #f5f5dc 0%, #e8d4a0 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  color: #2c3e50;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  opacity: 0.9;
}

.ghost-value {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-size: 0.7rem;
  color: #666;
}

.action-buttons {
  display: flex;
  gap: 6px;
  margin-top: 12px;
}

.action-btn {
  flex: 1;
  padding: 8px 6px;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #e4e4e7;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.btn-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.btn-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.play-btn:not(:disabled):active {
  background: rgba(34, 197, 94, 0.15);
  transform: scale(0.95);
}

.recall-btn:not(:disabled):active {
  background: rgba(234, 179, 8, 0.15);
  transform: scale(0.95);
}

.pass-btn:not(:disabled):active {
  background: rgba(168, 85, 247, 0.15);
  transform: scale(0.95);
}

.exchange-btn:not(:disabled):active {
  background: rgba(59, 130, 246, 0.15);
  transform: scale(0.95);
}

.message-box {
  padding: 12px 15px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  text-align: center;
  margin-top: 15px;
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
