<template>
  <div class="mobile-rack-view">
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
              @dragover="onBoardDragOver"
              @drop="onBoardDrop($event, square)"
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
          :class="{ dragging: draggedIndex === index }"
          draggable="true"
          @dragstart="onTileDragStart($event, letter, index)"
          @dragover="onRackDragOver($event, index)"
          @drop="onRackDrop($event, index)"
          @dragend="onDragEnd"
        >
          <span class="letter">{{ (letter || '★').toUpperCase() }}</span>
          <span class="value">{{ getLetterValue(letter) }}</span>
        </div>
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
      viewportCenter: { row: 7, col: 7 }, // Center of the 15x15 board
      draggedLetter: null,
      draggedIndex: null,
      dragSource: null // 'rack' or 'board'
    };
  },
  mounted() {
    this.startPolling();
  },
  beforeUnmount() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
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
    onTileDragStart(event, letter, index) {
      this.draggedLetter = letter;
      this.draggedIndex = index;
      this.dragSource = 'rack';
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({ letter, index }));
    },
    onRackDragOver(event, targetIndex) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    onRackDrop(event, targetIndex) {
      event.preventDefault();
      
      if (this.dragSource === 'rack' && this.draggedIndex !== null && this.draggedIndex !== targetIndex) {
        // Reorder tiles in rack
        const newRack = [...this.rack];
        const [draggedItem] = newRack.splice(this.draggedIndex, 1);
        newRack.splice(targetIndex, 0, draggedItem);
        this.rack = newRack;
      }
    },
    onBoardDragOver(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    async onBoardDrop(event, cell) {
      event.preventDefault();
      
      if (!this.isCurrentPlayer) {
        return; // Only allow drops on your turn
      }
      
      if (this.dragSource === 'rack' && this.draggedLetter !== null && cell.letter === null && !cell.locked) {
        // Send the move to the server
        try {
          await fetch('/api/place-tile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId: this.playerId,
              letter: this.draggedLetter,
              rackIndex: this.draggedIndex,
              row: cell.actualRow,
              col: cell.actualCol
            })
          });
          
          // Remove tile from local rack immediately for better UX
          const newRack = [...this.rack];
          newRack.splice(this.draggedIndex, 1);
          this.rack = newRack;
          
          // Then fetch updated data from server
          await this.fetchRackData();
        } catch (error) {
          console.error('Failed to place tile:', error);
          // Refresh to get correct state
          await this.fetchRackData();
        }
      }
    },
    onDragEnd() {
      this.draggedLetter = null;
      this.draggedIndex = null;
      this.dragSource = null;
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
</style>
