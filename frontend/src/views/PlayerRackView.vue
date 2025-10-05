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
        <h1>{{ playerName }}</h1>
        <div :class="['turn-status', { active: isCurrentPlayer }]">
          {{ isCurrentPlayer ? '🟢 YOUR TURN' : '⏸️ WAIT' }}
        </div>
      </div>
      
      <div class="score-display">
        <p>Score</p>
        <h2>{{ score }}</h2>
      </div>
      
      <!-- Mini Board View (5x5) -->
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
              <span v-if="square.letter" class="board-letter" :class="{ locked: square.locked }">
                {{ square.letter.toUpperCase() }}
                <span class="letter-points">{{ getLetterValue(square.letter) }}</span>
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
          :class="{ dragging: draggedIndex === index && isDragging }"
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
      
      <div class="refresh-info">
        <p>📱 Page updates automatically</p>
        <p class="connection-status" :class="{ connected: isConnected }">
          {{ isConnected ? '🟢 Connected' : '🔴 Connecting...' }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PlayerRackView',
  props: {
    playerId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      playerName: '',
      rack: [],
      score: 0,
      isCurrentPlayer: false,
      isConnected: false,
      gameId: '',
      pollInterval: null,
      board: [],
      viewportCenter: { row: 7, col: 7 },
      draggedLetter: null,
      draggedIndex: null,
      dragSource: null,
      // Touch-based drag state
      isDragging: false,
      touchStartX: 0,
      touchStartY: 0,
      currentTouchX: 0,
      currentTouchY: 0,
      draggedElement: null,
      dropTarget: null,
      // Debug console
      showDebugConsole: false,
      debugLogs: []
    };
  
  },
  computed: {
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
    }
  },
  mounted() {
    // Override console.log to capture logs
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
    
    this.fetchRackData();
    // Poll for updates every 2 seconds
    this.pollInterval = setInterval(() => {
      this.fetchRackData();
    }, 2000);
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
      // Keep only last 50 logs
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
    async fetchRackData() {
      try {
        // Use fetch to get data from a simple endpoint
        const response = await fetch(`/api/rack/${this.playerId}`);
        if (response.ok) {
          const data = await response.json();
          this.playerName = data.playerName;
          this.rack = data.rack;
          this.score = data.score;
          this.isCurrentPlayer = data.isCurrentPlayer;
          this.board = data.board || [];
          
          // Log a sample square to see its structure
          if (this.board.length > 7 && this.board[7].length > 7) {
            const centerSquare = this.board[7][7];
            console.log('[Fetch] Center square (7,7): letter=' + centerSquare.letter + ', locked=' + centerSquare.locked + ', type=' + centerSquare.type);
          }
          
          if (data.viewportCenter) {
            this.viewportCenter = data.viewportCenter;
          }
          this.isConnected = true;
        } else {
          this.isConnected = false;
        }
      } catch (error) {
        console.error('Error fetching rack data:', error);
        this.isConnected = false;
      }
    },
    startPolling() {
      // Initial fetch
      this.fetchRackData();
      
      // Poll every 2 seconds
      this.pollInterval = setInterval(() => {
        this.fetchRackData();
      }, 2000);
    },
    getVisibleBoard() {
      if (!this.board || this.board.length === 0) return [];
      
      // Get 5x5 grid centered on viewport
      const result = [];
      for (let i = 0; i < 5; i++) {
        const row = [];
        for (let j = 0; j < 5; j++) {
          const boardRow = this.viewportCenter.row - 2 + i;
          const boardCol = this.viewportCenter.col - 2 + j;
          
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
      this.dragSource = 'rack';
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.currentTouchX = touch.clientX;
      this.currentTouchY = touch.clientY;
      this.draggedElement = event.target.closest('.tile');
    },
    onTouchMove(event) {
      if (!this.isDragging) return;
      
      const touch = event.touches[0];
      this.currentTouchX = touch.clientX;
      this.currentTouchY = touch.clientY;
      
      // Find element under touch point
      const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // Highlight drop target
      if (this.dropTarget) {
        this.dropTarget.classList.remove('drop-target-active');
      }
      
      if (elementUnderTouch) {
        const dropZone = elementUnderTouch.closest('.drop-zone, .tile');
        if (dropZone && dropZone !== this.draggedElement) {
          this.dropTarget = dropZone;
          dropZone.classList.add('drop-target-active');
        }
      }
    },
    async onTouchEnd(event) {
      if (!this.isDragging) return;
      
      const touch = event.changedTouches[0];
      const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // Clean up drop target highlight
      if (this.dropTarget) {
        this.dropTarget.classList.remove('drop-target-active');
      }
      
      if (elementUnderTouch) {
        // Check if dropped on another rack tile (reorder)
        const rackTile = elementUnderTouch.closest('.tile');
        if (rackTile && rackTile !== this.draggedElement) {
          const targetIndex = parseInt(rackTile.dataset.index);
          if (!isNaN(targetIndex) && this.draggedIndex !== targetIndex) {
            // Reorder tiles in rack
            const newRack = [...this.rack];
            const [draggedItem] = newRack.splice(this.draggedIndex, 1);
            newRack.splice(targetIndex, 0, draggedItem);
            this.rack = newRack;
          }
        }
        
        // Check if dropped on board square
        const boardSquare = elementUnderTouch.closest('.drop-zone');
        console.log('[Touch] Element under touch:', elementUnderTouch);
        console.log('[Touch] Closest board square:', boardSquare);
        
        if (boardSquare && this.isCurrentPlayer) {
          const row = parseInt(boardSquare.dataset.boardRow);
          const col = parseInt(boardSquare.dataset.boardCol);
          
          console.log('[Touch] Board position:', { row, col, isNaN: isNaN(row) || isNaN(col) });
          
          if (!isNaN(row) && !isNaN(col)) {
            // Find the square data
            const visibleBoard = this.getVisibleBoard();
            console.log('[Touch] Visible board size:', visibleBoard.length, 'x', visibleBoard[0]?.length);
            
            for (const rowArray of visibleBoard) {
              for (const square of rowArray) {
                if (square.actualRow === row && square.actualCol === col) {
                  console.log('[Touch] Found square: actualRow=' + square.actualRow + ', actualCol=' + square.actualCol + ', letter=' + square.letter + ', locked=' + square.locked + ', type=' + square.type);
                  
                  const letterIsEmpty = !square.letter || square.letter === null || square.letter === '';
                  const isNotLocked = !square.locked;
                  const isNotOutOfBounds = square.type !== 'out-of-bounds';
                  
                  console.log('[Touch] Checks: letterIsEmpty=' + letterIsEmpty + ', isNotLocked=' + isNotLocked + ', isNotOutOfBounds=' + isNotOutOfBounds);
                  
                  if (letterIsEmpty && isNotLocked && isNotOutOfBounds) {
                    console.log('[Touch] Placing tile: playerId=' + this.playerId + ', letter=' + this.draggedLetter + ', rackIndex=' + this.draggedIndex + ', row=' + row + ', col=' + col);
                    
                    // Place tile on board
                    try {
                      const response = await fetch('/api/place-tile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          playerId: this.playerId,
                          letter: this.draggedLetter,
                          rackIndex: this.draggedIndex,
                          row: row,
                          col: col
                        })
                      });
                      
                      const result = await response.json();
                      console.log('[Touch] API result:', result);
                      
                      // Remove tile from local rack immediately
                      const newRack = [...this.rack];
                      newRack.splice(this.draggedIndex, 1);
                      this.rack = newRack;
                      console.log('[Touch] Local rack updated, fetching from server...');
                      
                      // Fetch updated state
                      await this.fetchRackData();
                    } catch (error) {
                      console.error('[Touch] Failed to place tile: ' + error.message);
                      await this.fetchRackData();
                    }
                  } else {
                    console.log('[Touch] Square not available: hasLetter=' + (!!square.letter) + ', locked=' + square.locked + ', outOfBounds=' + (square.type === 'out-of-bounds'));
                  }
                  break;
                }
              }
            }
          } else {
            console.log('[Touch] Invalid row/col from dataset');
          }
        } else if (boardSquare) {
          console.log('[Touch] Board square found but not current player');
        } else {
          console.log('[Touch] No board square found');
        }
      }
      
      // Reset drag state
      this.isDragging = false;
      this.draggedLetter = null;
      this.draggedIndex = null;
      this.dragSource = null;
      this.draggedElement = null;
      this.dropTarget = null;
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
  font-family: Arial, sans-serif;
  background: linear-gradient(135deg, #667eea, #764ba2);
  min-height: 100vh;
  padding: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Debug Console */
.debug-console {
  position: fixed;
  top: 10px;
  left: 10px;
  right: 10px;
  bottom: 10px;
  background: rgba(0, 0, 0, 0.95);
  color: #0f0;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  z-index: 10000;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.debug-header {
  background: #222;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #444;
}

.debug-header span {
  flex: 1;
  font-weight: bold;
}

.close-debug, .clear-debug {
  background: #444;
  color: #fff;
  border: none;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
}

.close-debug:active, .clear-debug:active {
  background: #666;
}

.debug-logs {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  -webkit-overflow-scrolling: touch;
}

.debug-log {
  margin-bottom: 5px;
  word-wrap: break-word;
  padding: 5px;
  border-left: 3px solid #0f0;
  background: rgba(0, 255, 0, 0.05);
}

.debug-log.error {
  color: #f55;
  border-left-color: #f55;
  background: rgba(255, 0, 0, 0.1);
}

.debug-log.warn {
  color: #ff5;
  border-left-color: #ff5;
  background: rgba(255, 255, 0, 0.1);
}

.log-time {
  color: #888;
  margin-right: 8px;
}

.log-message {
  color: inherit;
}

.debug-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.8);
  color: #0f0;
  border: 2px solid #0f0;
  font-size: 24px;
  cursor: pointer;
  z-index: 9999;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
}

.debug-toggle:active {
  transform: scale(0.95);
}

.rack-container {
  background: #fff;
  border-radius: 15px;
  padding: 20px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 10px 30px rgba(0,0,0,.3);
}

.rack-header {
  text-align: center;
  margin-bottom: 15px;
}

.rack-header h1 {
  font-size: 1.5rem;
  color: #333;
  margin-bottom: 8px;
}

.turn-status {
  display: inline-block;
  padding: 6px 15px;
  border-radius: 15px;
  font-size: .9rem;
  font-weight: bold;
  background: #999;
  color: #fff;
  transition: all 0.3s ease;
}

.turn-status.active {
  background: #4CAF50;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.score-display {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  padding: 15px;
  border-radius: 10px;
  text-align: center;
  margin-bottom: 15px;
}

.score-display p {
  font-size: .8rem;
  opacity: .9;
  text-transform: uppercase;
}

.score-display h2 {
  font-size: 2.5rem;
  font-weight: bold;
  margin-top: 5px;
}

.mini-board-section {
  margin: 15px 0;
}

.board-label {
  text-align: center;
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 8px;
  font-weight: bold;
}

.mini-board {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #2c3e50;
  padding: 4px;
  border-radius: 8px;
  overflow-x: auto;
}

.board-row {
  display: flex;
  gap: 2px;
}

.board-square {
  width: 50px;
  height: 50px;
  background-color: #e8dcc4;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
  position: relative;
  flex-shrink: 0;
}

.board-square.tw {
  background-color: #e74c3c;
  color: white;
}

.board-square.dw {
  background-color: #ffb3ba;
  color: white;
}

.board-square.tl {
  background-color: #3498db;
  color: white;
}

.board-square.dl {
  background-color: #add8e6;
  color: white;
}

.board-square.center {
  background-color: #ffb3ba;
  color: white;
}

.board-square.out-of-bounds {
  background-color: #34495e;
  opacity: 0.3;
}

.board-letter {
  font-size: 1.5rem;
  color: #333;
  background: linear-gradient(135deg, #f0e68c, #daa520);
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  position: relative;
}

.board-letter.locked {
  opacity: 0.85;
}

.letter-points {
  position: absolute;
  bottom: 2px;
  right: 3px;
  font-size: 0.6rem;
  color: #666;
}

.square-label {
  font-size: 0.6rem;
  opacity: 0.7;
}

.tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin: 15px 0;
}

.tile {
  width: 55px;
  height: 55px;
  background: linear-gradient(135deg, #f0e68c, #daa520);
  border: 2px solid #333;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0,0,0,.2);
  position: relative;
  cursor: grab;
  touch-action: none;
}

.tile:active {
  cursor: grabbing;
}

.tile.dragging {
  opacity: 0.5;
  transform: scale(0.95);
}

.tile .letter {
  font-size: 1.8rem;
  font-weight: bold;
  color: #333;
}

.tile .value {
  position: absolute;
  bottom: 3px;
  right: 5px;
  font-size: .7rem;
  font-weight: bold;
  color: #666;
}

.refresh-info {
  background: #e3f2fd;
  padding: 10px;
  border-radius: 8px;
  text-align: center;
  margin-bottom: 15px;
}

.refresh-info p {
  margin: 5px 0;
  font-size: 0.85rem;
  color: #1976d2;
}

.connection-status {
  font-weight: bold;
  color: #f44336;
}

.connection-status.connected {
  color: #4CAF50;
}

/* Ghost tile that follows finger */
.ghost-tile {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #f0e68c, #daa520);
  border: 2px solid #333;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  font-weight: bold;
  color: #333;
  opacity: 0.8;
  pointer-events: none;
  z-index: 9999;
  box-shadow: 0 4px 10px rgba(0,0,0,.4);
}

/* Drop target highlighting */
.drop-target-active {
  transform: scale(1.05);
  box-shadow: 0 0 10px rgba(66, 153, 225, 0.8);
  border: 2px solid #4299e1 !important;
  transition: all 0.1s ease;
}
</style>
