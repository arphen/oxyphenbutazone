<template>
  <div class="mobile-rack-view" :class="{ 'my-turn': isCurrentPlayer, 'turn-flash': showTurnFlash }">
    <!-- Turn Flash Overlay -->
    <div v-if="showTurnFlash" class="flash-overlay"></div>
    
    <!-- Debug Console Overlay -->
    <div v-if="isDebug() && showDebugConsole" class="debug-console">
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
    <button v-else-if="isDebug()" @click="showDebugConsole = true" class="debug-toggle">🐛</button>
    
    <div class="rack-container">
      <div class="rack-header">
        <div class="player-info">
          <span class="player-name">{{ playerName }}</span>
          <span class="score-value">{{ score }}</span>
        </div>
        <div :class="['turn-status', { active: isCurrentPlayer }]">
          {{ isCurrentPlayer ? '▶' : '⏸' }}
        </div>
      </div>
      
      <!-- Mini Board View (7x7) -->
      <div class="mini-board-section">
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
          <span class="btn-label">Play Word</span>
        </button>
        <div class="button-row">
          <button 
            class="action-btn recall-btn" 
            @click="recallTiles"
            :disabled="!isCurrentPlayer || !hasNewTiles"
          >
            <span class="btn-icon">↩️</span>
            <span class="btn-label">Recall</span>
          </button>
          <button 
            class="action-btn shuffle-btn" 
            @click="shuffleRack"
          >
            <span class="btn-icon">🔀</span>
            <span class="btn-label">Shuffle</span>
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
      </div>
      
      <div class="message-box" v-if="gameState?.message" :class="gameState?.messageType">
        {{ gameState.message }}
      </div>
    </div>
    
    <!-- Game Over Modal -->
    <GameOverModal
      :show="gameState?.gameOver || false"
      :winner="gameState?.winner"
      :gameState="gameState"
      :finalScore1="gameState?.finalScores?.player1 || 0"
      :finalScore2="gameState?.finalScores?.player2 || 0"
      :gameScore1="gameState?.player1?.score || 0"
      :gameScore2="gameState?.player2?.score || 0"
      :remaining1="gameState?.finalScores?.player1Remaining || 0"
      :remaining2="gameState?.finalScores?.player2Remaining || 0"
      @new-game="restartGame"
      @close="handleGameOverClose"
    />
    
    <!-- Swap Tiles Modal -->
    <SwapTilesModal
      :isVisible="showSwapModal"
      :rack="rack"
      @close="showSwapModal = false"
      @swap="handleSwapTiles"
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
import SwapTilesModal from '../components/SwapTilesModal.vue';
import { useSoundEffects } from '../composables/useSoundEffects.js';
import { useGamePersistence } from '../composables/useGamePersistence.js';
import { isDebug, debug, warn, error } from '../utils/log';

export default {
  name: 'PlayerRackView',
  components: {
    GameOverModal,
    BlankLetterPicker,
    SwapTilesModal,
  },
  setup() {
    const { playClickSound, setVolume } = useSoundEffects();
    const gamePersistence = useGamePersistence();
    return {
      playClickSound,
      setVolume,
      gamePersistence
    };
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
      // Swap tiles
      showSwapModal: false,
      // Debug console
      showDebugConsole: false,
      debugLogs: [],
      // Turn change animation
      previousTurnPlayer: null,
      showTurnFlash: false,
      // Original console methods for restoration
      originalLog: null,
      originalError: null,
      originalWarn: null
    };
  },
  computed: {
    playerName() {
      if (!this.gameState) return '';
      const player = this.gameState[`player${this.playerId}`];
      return player?.playerName || '';
    },
    rack() {
      if (!this.gameState) return [];
      const player = this.gameState[`player${this.playerId}`];
      return player?.rack || [];
    },
    score() {
      if (!this.gameState) return 0;
      const player = this.gameState[`player${this.playerId}`];
      return player?.score || 0;
    },
    isCurrentPlayer() {
      if (!this.gameState) return false;
      const player = this.gameState[`player${this.playerId}`];
      const result = player?.isCurrentPlayer || false;
      // debug('[isCurrentPlayer computed] Player', this.playerId, ':', result);
      return result;
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
    // Override console for debug logs only when debug mode is enabled
    if (isDebug()) {
      this.originalLog = console['log'];
      this.originalError = console['error'];
      this.originalWarn = console['warn'];

      console['log'] = (...args) => {
        this.addDebugLog('log', args.join(' '));
        this.originalLog.apply(console, args);
      };

      console['error'] = (...args) => {
        this.addDebugLog('error', args.join(' '));
        this.originalError.apply(console, args);
      };

      console['warn'] = (...args) => {
        this.addDebugLog('warn', args.join(' '));
        this.originalWarn.apply(console, args);
      };
    }

    this.fetchGameState();
    this.pollInterval = setInterval(() => {
      this.fetchGameState();
    }, 500);
  },
  beforeUnmount() {
    // Restore original console methods if they were overridden
    if (this.originalLog) {
      console['log'] = this.originalLog;
      console['error'] = this.originalError;
      console['warn'] = this.originalWarn;
    }

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
    async shuffleRack() {
      if (!this.rack || this.rack.length < 2) return;
      
      // Create a copy and shuffle
      const newRack = [...this.rack];
      for (let i = newRack.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newRack[i], newRack[j]] = [newRack[j], newRack[i]];
      }
      
      try {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'reorder-rack',
            playerId: this.playerId,
            newRack: newRack
          })
        });
        
        // Optimistically update local state to avoid flicker
        if (this.gameState && this.gameState[`player${this.playerId}`]) {
           this.gameState[`player${this.playerId}`].rack = newRack;
        }
        
        this.playClickSound();
      } catch (error) {
        error('Failed to shuffle rack:', error);
      }
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
              warn('[GamePersistence] Game in progress detected but not tracked. Starting tracking now.');
              this.gamePersistence.startNewGame(newGameState);
            }
          }
          
          // Check if turn changed to this player
          if (this.gameState) {
            const wasMyTurn = this.gameState[`player${this.playerId}`]?.isCurrentPlayer;
            const isNowMyTurn = newGameState[`player${this.playerId}`]?.isCurrentPlayer;
            
            if (!wasMyTurn && isNowMyTurn) {
              // Trigger flash animation
              this.showTurnFlash = true;
              setTimeout(() => {
                this.showTurnFlash = false;
              }, 1000);
            }
          }
          
          this.gameState = newGameState;
          this.isConnected = true;
        } else {
          this.isConnected = false;
        }
      } catch (error) {
        error('Error fetching game state:', error);
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
      
      debug(`[Drag Start] Index: ${index}, Letter: ${letter || 'BLANK'}`);
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
            debug('[Drag Intent] REORDER detected');
          } else if (deltaY > this.dragThreshold && deltaY > deltaX) {
            // Moving upward more than horizontally - likely placing on board
            this.dragIntent = 'place';
            debug('[Drag Intent] PLACE detected (upward movement)');
          } else if (boardSquare) {
            this.dragIntent = 'place';
            debug('[Drag Intent] PLACE detected (over board)');
          } else {
            // Default to reorder if moving horizontally within rack area
            this.dragIntent = 'reorder';
            debug('[Drag Intent] REORDER detected (horizontal movement)');
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
      debug(`[Drag End] Duration: ${dragDuration}ms, Intent: ${this.dragIntent || 'undetermined'}`);
      
      if (elementUnderTouch) {
        // Handle reordering within rack
        const rackTile = elementUnderTouch.closest('.tile');
        if (rackTile && rackTile !== this.draggedElement && this.dragIntent === 'reorder') {
          const targetIndex = parseInt(rackTile.dataset.index);
          if (!isNaN(targetIndex) && this.draggedIndex !== targetIndex) {
            debug(`[Reorder] Moving tile from index ${this.draggedIndex} to ${targetIndex}`);
            
            // Reorder tiles in rack
            const newRack = [...this.rack];
            const [draggedItem] = newRack.splice(this.draggedIndex, 1);
            newRack.splice(targetIndex, 0, draggedItem);
            
            debug(`[Reorder] New rack order:`, newRack);
            
            // Persist to server
            try {
              const response = await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'reorder-rack',
                  playerId: this.playerId,
                  newRack: newRack
                })
              });
              
              if (response.ok) {
                const result = await response.json();
                this.gameState = result.gameState;
                debug('[Reorder] Rack reordering persisted to server');
              }
            } catch (error) {
              error('Failed to reorder rack:', error);
            }
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
                    debug(`[Place] Placing tile at (${row}, ${col})`);
                    
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
                          debug('[Place] Tile placed successfully');
                          // Play sound effect when tile is placed
                          debug('[Sound] Attempting to play click sound after tile placement');
                          this.playClickSound();
                        }
                      } catch (error) {
                        error('Failed to place tile:', error);
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
      
      // Play sound effect
      debug('[Sound] Attempting to play click sound for Play Word button');
      this.playClickSound();
      
      // Capture state before move
      const player = this.gameState[`player${this.playerId}`];
      const stateBefore = {
        rackBefore: [...(player?.rack || [])],
        scoreBefore: player?.score || 0,
        boardStateBefore: this.captureBoard(this.gameState.board)
      };
      
      // Capture tiles that are currently placed (marked as isNew)
      const tilesPlaced = [];
      if (this.gameState?.board) {
        for (let row = 0; row < this.gameState.board.length; row++) {
          for (let col = 0; col < this.gameState.board[row].length; col++) {
            const cell = this.gameState.board[row][col];
            if (cell.isNew && cell.letter) {
              tilesPlaced.push({
                row,
                col,
                letter: cell.letter,
                isBlank: cell.isBlank,
                chosenLetter: cell.chosenLetter
              });
            }
          }
        }
      }
      
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
          const newGameState = result.gameState;
          
          // Extract words formed from player history
          const playerHistory = newGameState[`player${this.playerId}`]?.history;
          const lastMove = playerHistory?.[playerHistory.length - 1];
          
          // Log the state before saving
          debug('[PlayerRackView] About to save move with newGameState:', {
            hasBoardData: !!newGameState.board && newGameState.board.length > 0,
            boardLength: newGameState.board?.length,
            player1Rack: newGameState.player1?.rack,
            player2Rack: newGameState.player2?.rack,
            tilesPlaced,
            wordsFormed: lastMove?.words
          });
          
          // Save move to persistence
          this.gamePersistence.saveMove(newGameState, 'play-word', {
            playerId: this.playerId,
            ...stateBefore,
            tilesPlaced,
            wordsFormed: lastMove?.words || [],
            valid: lastMove?.action !== 'invalid'
          });
          
          this.gameState = newGameState;
          
          // Check if game is over and save it
          if (newGameState.gameOver) {
            this.gamePersistence.completeGame(newGameState);
          }
        }
      } catch (error) {
        error('Failed to play word:', error);
      }
    },
    async recallTiles() {
      if (!this.isCurrentPlayer || !this.hasNewTiles) return;
      
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
        error('Failed to recall tiles:', error);
      }
    },
    async passTurn() {
      if (!this.isCurrentPlayer || this.hasNewTiles) return;
      
      // Capture state before pass
      const player = this.gameState[`player${this.playerId}`];
      const stateBefore = {
        rackBefore: [...(player?.rack || [])],
        scoreBefore: player?.score || 0
      };
      
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
          debug('[Pass] Before update - isCurrentPlayer:', this.isCurrentPlayer);
          debug('[Pass] New gameState player1.isCurrentPlayer:', result.gameState.player1?.isCurrentPlayer);
          debug('[Pass] New gameState player2.isCurrentPlayer:', result.gameState.player2?.isCurrentPlayer);
          debug('[Pass] This player ID:', this.playerId);
          
          // Save pass action
          this.gamePersistence.saveMove(result.gameState, 'pass', {
            playerId: this.playerId,
            ...stateBefore
          });
          
          // Update game state - this should trigger reactivity
          this.gameState = result.gameState;
          
          // Force immediate re-render to ensure UI updates
          this.$nextTick(() => {
            debug('[Pass] After nextTick - isCurrentPlayer:', this.isCurrentPlayer);
          });
        }
      } catch (error) {
        error('Failed to pass turn:', error);
      }
    },
    async exchangeTiles() {
      if (!this.isCurrentPlayer) return;
      this.showSwapModal = true;
    },
    async handleSwapTiles(selectedIndices) {
      if (!this.isCurrentPlayer) return;

      // Capture state before exchange
      const player = this.playerId === '1' ? this.gameState.player1 : this.gameState.player2;
      const stateBefore = {
        rackBefore: [...(player?.rack || [])],
        scoreBefore: player?.score || 0
      };

      try {
        const response = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'exchange-tiles',
            playerId: this.playerId,
            indices: selectedIndices,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          debug('[Exchange] Before update - isCurrentPlayer:', this.isCurrentPlayer);
          debug('[Exchange] New gameState player1.isCurrentPlayer:', result.gameState.player1?.isCurrentPlayer);
          debug('[Exchange] New gameState player2.isCurrentPlayer:', result.gameState.player2?.isCurrentPlayer);
          
          // Save exchange action
          this.gamePersistence.saveMove(result.gameState, 'exchange', {
            playerId: this.playerId,
            ...stateBefore,
            tilesExchanged: selectedIndices.length
          });
          
          this.gameState = result.gameState;
          
          // Force immediate re-render
          this.$nextTick(() => {
            debug('[Exchange] After nextTick - isCurrentPlayer:', this.isCurrentPlayer);
          });
        }
      } catch (error) {
        error('Failed to exchange tiles:', error);
      }
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
          // Play sound effect when blank tile is placed
          debug('[Sound] Attempting to play click sound after blank tile placement');
          this.playClickSound();
        }
      } catch (error) {
        error('Failed to place blank tile:', error);
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
        
        // Initialize new game in persistence
        if (this.gameState) {
          this.gamePersistence.startNewGame(this.gameState);
        }
      } catch (error) {
        error('Failed to restart game:', error);
      }
    },
    handleGameOverClose() {
      // When the game over modal is closed, complete the game if not already done
      if (this.gameState?.gameOver && this.gamePersistence.currentGameId.value) {
        debug('[GameOver] Completing game on modal close');
        this.gamePersistence.completeGame(this.gameState);
      }
      // Navigate to game history to see the completed game
      this.$router.push('/history');
    },
    captureBoard(board) {
      if (!board) return [];
      
      return board.map(row => 
        row.map(cell => ({
          letter: cell.letter || null,
          isBlank: cell.isBlank || false,
          chosenLetter: cell.chosenLetter || null,
          locked: cell.locked || false,
          isNew: cell.isNew || false,
          type: cell.type || 'normal'
        }))
      );
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
  padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  transition: background 0.6s ease;
}

.mobile-rack-view.my-turn {
  background: linear-gradient(270deg, #0f3460, #105220, #1a2e1a, #206330, #16213e);
  background-size: 600% 600%;
  animation: lavaFlow 10s ease infinite;
}

@keyframes lavaFlow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.flash-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center, rgba(34, 197, 94, 0.4) 0%, transparent 70%);
  pointer-events: none;
  z-index: 9999;
  animation: flashPulse 1s ease-out;
}

@keyframes flashPulse {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  30% {
    opacity: 1;
    transform: scale(1.1);
  }
  100% {
    opacity: 0;
    transform: scale(1.3);
  }
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
  border-radius: 16px;
  padding: 12px;
  max-width: 500px;
  width: calc(100% - 16px);
  max-height: calc(100vh - 16px);
  max-height: calc(-webkit-fill-available - 16px);
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.rack-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.player-info {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.player-name {
  font-size: 0.9rem;
  color: #a1a1aa;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.score-value {
  font-size: 1.8rem;
  color: #60a5fa;
  font-weight: 700;
}

.turn-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.turn-status.active {
  background: rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.5);
  box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
  animation: turnPulse 2s ease-in-out infinite;
}

@keyframes turnPulse {
  0%, 100% { 
    transform: scale(1);
    box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
  }
  50% { 
    transform: scale(1.1);
    box-shadow: 0 0 25px rgba(34, 197, 94, 0.6);
  }
}

.mini-board-section {
  margin-bottom: 12px;
}

.mini-board {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: rgba(0, 0, 0, 0.4);
  padding: 4px;
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
  box-shadow: 0 0 0 3px #86efac, inset 0 0 20px rgba(134, 239, 172, 0.6);
  background: rgba(34, 197, 94, 0.5) !important;
  transform: scale(1.08);
  transition: all 0.15s ease;
  z-index: 10;
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
  text-transform: uppercase;
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
  gap: 5px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.tile {
  position: relative;
  width: 50px;
  height: 50px;
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
  font-size: 1.6rem;
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
  pointer-events: none; /* Allow touch events to pass through to elements below */
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
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.button-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.action-btn {
  flex: 1;
  padding: 12px 6px;
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
  background: rgba(20, 20, 40, 0.4);
  backdrop-filter: blur(10px);
  color: #e4e4e7;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: rgba(50, 50, 70, 0.2);
  box-shadow: none;
  transform: none;
}

.action-btn:not(:disabled):hover {
  transform: translateY(-3px);
}

.btn-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.btn-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* --- Play Button (Green) --- */
.play-btn {
  width: 100%;
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.4);
  color: #a7f3d0;
}
.play-btn:not(:disabled):hover {
  background: rgba(16, 185, 129, 0.3);
  border-color: rgba(16, 185, 129, 0.6);
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.4), 0 4px 12px rgba(0,0,0,0.3);
}
.play-btn:not(:disabled):active {
  transform: scale(0.97);
  background: rgba(16, 185, 129, 0.4);
}

/* --- Recall Button (Amber) --- */
.recall-btn {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.4);
  color: #fde68a;
}
.recall-btn:not(:disabled):hover {
  background: rgba(245, 158, 11, 0.3);
  border-color: rgba(245, 158, 11, 0.6);
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.4), 0 4px 12px rgba(0,0,0,0.3);
}
.recall-btn:not(:disabled):active {
  transform: scale(0.97);
  background: rgba(245, 158, 11, 0.4);
}

/* --- Shuffle Button (Pink) --- */
.shuffle-btn {
  background: rgba(236, 72, 153, 0.2);
  border-color: rgba(236, 72, 153, 0.4);
  color: #fbcfe8;
}
.shuffle-btn:not(:disabled):hover {
  background: rgba(236, 72, 153, 0.3);
  border-color: rgba(236, 72, 153, 0.6);
  box-shadow: 0 0 20px rgba(236, 72, 153, 0.4), 0 4px 12px rgba(0,0,0,0.3);
}
.shuffle-btn:not(:disabled):active {
  transform: scale(0.97);
  background: rgba(236, 72, 153, 0.4);
}

/* --- Pass Button (Purple) --- */
.pass-btn {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.4);
  color: #ddd6fe;
}
.pass-btn:not(:disabled):hover {
  background: rgba(139, 92, 246, 0.3);
  border-color: rgba(139, 92, 246, 0.6);
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.4), 0 4px 12px rgba(0,0,0,0.3);
}
.pass-btn:not(:disabled):active {
  transform: scale(0.97);
  background: rgba(139, 92, 246, 0.4);
}

/* --- Exchange/Swap Button (Blue) --- */
.exchange-btn {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
  color: #bfdbfe;
}
.exchange-btn:not(:disabled):hover {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.4), 0 4px 12px rgba(0,0,0,0.3);
}
.exchange-btn:not(:disabled):active {
  transform: scale(0.97);
  background: rgba(59, 130, 246, 0.4);
}

.message-box {
  padding: 10px 12px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  text-align: center;
  margin-top: 10px;
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
