<template>
  <div class="mobile-rack-view" :class="{ 'my-turn': isCurrentPlayer, 'turn-flash': showTurnFlash }">
    <!-- Turn Flash Overlay -->
    <div v-if="showTurnFlash" class="flash-overlay"></div>
    
    <!-- Debug Console Overlay -->
    <div v-if="debugEnabled && showDebugConsole" class="debug-console">
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
    <button v-else-if="debugEnabled" @click="showDebugConsole = true" class="debug-toggle">🐛</button>
    
    <div class="rack-container">
      <header class="rack-header">
        <div class="player-info">
          <span class="player-name">{{ playerName }}</span>
          <span class="score-value">{{ score }}</span>
        </div>
        <div :class="['turn-status', { active: isCurrentPlayer }]" data-testid="turn-status">
          {{ isCurrentPlayer ? 'Your turn' : `${currentPlayerName}'s turn` }}
        </div>
      </header>

      <PhoneBoard
        ref="phoneBoard"
        :board="board"
        :language="gameState?.language || 'english'"
        :center-row="viewportCenter.row"
        :center-col="viewportCenter.col"
        :placing="isCurrentPlayer && selectedIndex !== null"
        @cell-tap="onCellTap"
      >
        <template #hint>
          <span class="hint" data-testid="hint">{{ hintText }}</span>
        </template>
      </PhoneBoard>

      <div class="tiles" data-testid="rack">
        <div
          v-for="(letter, index) in rack"
          :key="index"
          class="tile"
          :class="{
            dragging: draggedIndex === index && isDragging && dragIntent,
            selected: selectedIndex === index,
            'blank-tile': letter === ''
          }"
          role="button"
          :aria-pressed="selectedIndex === index"
          :data-index="index"
          :data-letter="letter"
          @click="onRackTileClick(index)"
          @touchstart="onTileTouchStart($event, letter, index)"
          @touchmove.prevent="onTouchMove"
          @touchend="onTouchEnd"
        >
          <span class="letter">{{ (letter || '★').toUpperCase() }}</span>
          <span class="value">{{ getLetterValue(letter) }}</span>
        </div>
      </div>

      <!-- Ghost tile that follows finger during drag -->
      <div v-if="isDragging && dragIntent" class="ghost-tile" :style="ghostTileStyle">
        {{ (draggedLetter || '★').toUpperCase() }}
        <span class="ghost-value">{{ getLetterValue(draggedLetter) }}</span>
      </div>

      <div v-if="notice" class="message-box error" data-testid="notice">{{ notice }}</div>
      <div v-if="gameState?.message" class="message-box" :class="gameState?.messageType" data-testid="message">
        {{ gameState.message }}
      </div>
    </div>

    <!-- Action bar, pinned above the home indicator -->
    <nav class="action-bar" aria-label="Game actions">
      <div class="action-bar-inner">
        <button
          class="action-btn play-btn"
          data-testid="play-btn"
          :disabled="!isCurrentPlayer || !hasNewTiles || busy"
          @click="playWord"
        >
          <span class="btn-icon">▶️</span>
          <span class="btn-label">Play</span>
        </button>
        <button
          class="action-btn recall-btn"
          data-testid="recall-btn"
          :disabled="!isCurrentPlayer || !hasNewTiles || busy"
          @click="recallTiles"
        >
          <span class="btn-icon">↩️</span>
          <span class="btn-label">Recall</span>
        </button>
        <button class="action-btn shuffle-btn" data-testid="shuffle-btn" :disabled="rack.length < 2" @click="shuffleRack">
          <span class="btn-icon">🔀</span>
          <span class="btn-label">Shuffle</span>
        </button>
        <button
          class="action-btn exchange-btn"
          data-testid="swap-btn"
          :disabled="!isCurrentPlayer || hasNewTiles"
          @click="exchangeTiles"
        >
          <span class="btn-icon">🔄</span>
          <span class="btn-label">Swap</span>
        </button>
        <button
          class="action-btn pass-btn"
          data-testid="pass-btn"
          :disabled="!isCurrentPlayer || hasNewTiles"
          @click="passTurn"
        >
          <span class="btn-icon">⏭️</span>
          <span class="btn-label">Pass</span>
        </button>
      </div>
    </nav>

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
      :language="gameState?.language"
      @close="showSwapModal = false"
      @swap="handleSwapTiles"
    />

    <!-- Blank Letter Picker -->
    <BlankLetterPicker
      v-if="showBlankPicker"
      :alphabet="alphabet"
      @select="handleBlankLetterSelect"
      @cancel="showBlankPicker = false"
    />
  </div>
</template>

<script>
import GameOverModal from '../components/GameOverModal.vue';
import BlankLetterPicker from '../components/BlankLetterPicker.vue';
import SwapTilesModal from '../components/SwapTilesModal.vue';
import PhoneBoard from '../components/PhoneBoard.vue';
import { letterValue, getAlphabet } from '../shared/rules';
import { useSoundEffects } from '../composables/useSoundEffects.js';
import { useGamePersistence } from '../composables/useGamePersistence.js';
import { isDebug, debug, logWarn, logError } from '../utils/log';

export default {
  name: 'PlayerRackView',
  components: {
    GameOverModal,
    BlankLetterPicker,
    SwapTilesModal,
    PhoneBoard,
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
      // Tap-to-place: the rack tile picked up by a tap (index + letter, so a changed rack drops the selection)
      selectedIndex: null,
      selectedLetter: null,
      busy: false, // a tap action is in flight; further board taps are ignored until it lands
      suppressClick: false, // the click that follows a finished drag must not also select the tile
      notice: '',
      noticeTimer: null,
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
      debugEnabled: isDebug(),
      // Original console methods for restoration
      originalLog: null,
      originalError: null,
      originalWarn: null
    };
  },
  computed: {
    alphabet() {
      return getAlphabet(this.gameState?.language);
    },
    /** The seat as the integer the protocol requires (the route param is a string). */
    seat() {
      return Number(this.playerId);
    },
    currentPlayerName() {
      const current = this.gameState?.currentPlayer;
      return this.gameState?.[`player${current}`]?.playerName || `Player ${current ?? ''}`;
    },
    hintText() {
      if (!this.gameState) return 'Connecting…';
      if (this.gameState.gameOver) return 'Game over';
      if (!this.isCurrentPlayer) return `Waiting for ${this.currentPlayerName}. Pinch or double-tap the board to zoom.`;
      if (this.selectedIndex !== null) {
        const letter = this.selectedLetter === '' ? 'the blank' : (this.selectedLetter || '').toUpperCase();
        return `Tap an empty square to place ${letter}`;
      }
      if (this.hasNewTiles) return 'Tap a placed tile to take it back, or Play';
      return 'Tap a tile, then tap a square';
    },
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
  watch: {
    rack(newRack) {
      // Drop a selection that no longer points at the same tile (shuffled, placed, swapped, new game...)
      if (this.selectedIndex !== null && newRack[this.selectedIndex] !== this.selectedLetter) this.clearSelection();
    },
  },
  mounted() {
    // Override console for debug logs only when debug mode is enabled
    if (this.debugEnabled) {
      this.originalLog = console.log;
      this.originalError = console.error;
      this.originalWarn = console.warn;

      console.log = (...args) => {
        this.addDebugLog('log', args.join(' '));
        this.originalLog.apply(console, args);
      };

      console.error = (...args) => {
        this.addDebugLog('error', args.join(' '));
        this.originalError.apply(console, args);
      };

      console.warn = (...args) => {
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
      console.log = this.originalLog;
      console.error = this.originalError;
      console.warn = this.originalWarn;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    clearTimeout(this.noticeTimer);
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
      return letterValue(this.gameState?.language, letter);
    },
    showNotice(text) {
      this.notice = text;
      clearTimeout(this.noticeTimer);
      this.noticeTimer = setTimeout(() => {
        this.notice = '';
      }, 2500);
    },
    clearSelection() {
      this.selectedIndex = null;
      this.selectedLetter = null;
    },
    onRackTileClick(index) {
      if (this.suppressClick) {
        this.suppressClick = false;
        return;
      }
      if (this.selectedIndex === index) {
        this.clearSelection();
        return;
      }
      this.selectedIndex = index;
      this.selectedLetter = this.rack[index];
    },
    /** POST one action; adopts the returned state. Returns the result, or null when the request failed. */
    async sendAction(action) {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action)
      });
      if (!response.ok) return null;
      const result = await response.json();
      if (result.gameState) this.gameState = result.gameState;
      return result;
    },
    async placeTile(rackIndex, row, col, chosenLetter) {
      const action = {
        type: 'place-tile',
        playerId: this.seat,
        letter: this.rack[rackIndex],
        rackIndex,
        row,
        col
      };
      if (chosenLetter) action.chosenLetter = chosenLetter;
      this.busy = true;
      try {
        const result = await this.sendAction(action);
        if (result?.success) {
          debug(`[Place] Tile placed at (${row}, ${col})`);
          this.playClickSound();
        } else if (result) {
          this.showNotice(result.error || 'Could not place that tile');
        }
      } catch (error) {
        logError('Failed to place tile:', error);
      } finally {
        this.busy = false;
      }
    },
    async recallTile(row, col) {
      this.busy = true;
      try {
        const result = await this.sendAction({ type: 'recall-tile', playerId: this.seat, row, col });
        if (result && !result.success) this.showNotice(result.error || 'Could not take that tile back');
      } catch (error) {
        logError('Failed to recall tile:', error);
      } finally {
        this.busy = false;
      }
    },
    /** A tap on a board square (from PhoneBoard). consume() tells the board the tap did something. */
    onCellTap({ row, col, consume }) {
      const cell = this.board[row]?.[col];
      if (!cell) return;
      if (this.busy) {
        consume();
        return;
      }
      if (cell.letter || cell.isBlank) {
        if (cell.isNew && this.isCurrentPlayer) {
          consume();
          this.recallTile(row, col);
        }
        return;
      }
      if (this.selectedIndex === null || !this.isCurrentPlayer || cell.locked) return;
      consume();
      const rackIndex = this.selectedIndex;
      const letter = this.rack[rackIndex];
      this.clearSelection();
      if (letter === '') {
        this.pendingBlankPosition = { row, col, rackIndex };
        this.showBlankPicker = true;
      } else {
        this.placeTile(rackIndex, row, col);
      }
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
            playerId: this.seat,
            newRack: newRack
          })
        });
        
        // Optimistically update local state to avoid flicker
        if (this.gameState && this.gameState[`player${this.playerId}`]) {
           this.gameState[`player${this.playerId}`].rack = newRack;
        }
        
        this.playClickSound();
      } catch (error) {
        logError('Failed to shuffle rack:', error);
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
              logWarn('[GamePersistence] Game in progress detected but not tracked. Starting tracking now.');
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
        logError('Error fetching game state:', error);
        this.isConnected = false;
      }
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
                  playerId: this.seat,
                  newRack: newRack
                })
              });
              
              if (response.ok) {
                const result = await response.json();
                this.gameState = result.gameState;
                debug('[Reorder] Rack reordering persisted to server');
              }
            } catch (error) {
              logError('Failed to reorder rack:', error);
            }
          }
        }
        
        // Handle placing tile on board
        const boardSquare = elementUnderTouch.closest('.drop-zone');
        if (boardSquare && this.isCurrentPlayer && (this.dragIntent === 'place' || !this.dragIntent)) {
          const row = parseInt(boardSquare.dataset.boardRow);
          const col = parseInt(boardSquare.dataset.boardCol);
          const square = this.board[row]?.[col];
          if (square && !square.letter && !square.isBlank && !square.locked) {
            debug(`[Place] Dropping tile at (${row}, ${col})`);
            this.clearSelection();
            if (this.draggedLetter === '') {
              this.pendingBlankPosition = { row, col, rackIndex: this.draggedIndex };
              this.showBlankPicker = true;
            } else {
              await this.placeTile(this.draggedIndex, row, col);
            }
          }
        }
      }

      // A real drag is followed by a click on the tile; it must not toggle the selection
      if (this.dragIntent) {
        this.suppressClick = true;
        setTimeout(() => {
          this.suppressClick = false;
        }, 400);
      }

      // Reset drag state
      this.isDragging = false;
      this.draggedLetter = null;
      this.draggedIndex = null;
      this.draggedElement = null;
      this.dropTarget = null;
      this.dragIntent = null;
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
            playerId: this.seat
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
        logError('Failed to play word:', error);
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
            playerId: this.seat
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          this.gameState = result.gameState;
        }
      } catch (error) {
        logError('Failed to recall tiles:', error);
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
            playerId: this.seat
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
        logError('Failed to pass turn:', error);
      }
    },
    async exchangeTiles() {
      if (!this.isCurrentPlayer) return;
      this.showSwapModal = true;
    },
    async handleSwapTiles(selectedIndices) {
      if (!this.isCurrentPlayer) return;

      // Capture state before exchange
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
            type: 'exchange-tiles',
            playerId: this.seat,
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
        logError('Failed to exchange tiles:', error);
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
            playerId: this.seat,
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
        logError('Failed to place blank tile:', error);
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
        logError('Failed to restart game:', error);
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
  /* A normal, scrollable page: only the board itself captures touch gestures */
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right))
    calc(var(--action-bar-height) + 12px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: background 0.6s ease;
  --action-bar-height: 64px;
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
  bottom: calc(var(--action-bar-height) + 20px + env(safe-area-inset-bottom));
  right: 12px;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e4e4e7;
  font-size: 22px;
  cursor: pointer;
  z-index: 900;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}

.rack-container {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rack-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 4px 2px 2px;
}

.player-info {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.player-name {
  font-size: 0.9rem;
  color: #a1a1aa;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.score-value {
  font-size: 1.6rem;
  color: #60a5fa;
  font-weight: 700;
  line-height: 1.1;
}

.turn-status {
  flex: 0 0 auto;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #a1a1aa;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  white-space: nowrap;
  transition: all 0.3s ease;
}

.turn-status.active {
  color: #bbf7d0;
  background: rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.55);
  box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
  animation: turnPulse 2s ease-in-out infinite;
}

@keyframes turnPulse {
  0%, 100% {
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.35);
  }
  50% {
    box-shadow: 0 0 22px rgba(34, 197, 94, 0.65);
  }
}

.hint {
  display: block;
  font-size: 0.85rem;
  line-height: 1.25;
  color: #cbd5e1;
}

.tiles {
  display: flex;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 4px 0;
}

.tile {
  position: relative;
  flex: 0 1 54px;
  min-width: 48px;
  height: 56px;
  background: linear-gradient(135deg, rgba(254, 240, 138, 0.95), rgba(252, 211, 77, 0.95));
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  touch-action: none;
  cursor: pointer;
  border: 1px solid rgba(161, 98, 7, 0.3);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.tile.selected {
  transform: translateY(-6px);
  box-shadow: 0 0 0 3px #22c55e, 0 0 18px rgba(34, 197, 94, 0.8), 0 6px 12px rgba(0, 0, 0, 0.4);
}

.tile.dragging {
  opacity: 0.5;
}

.tile.reorder-target {
  box-shadow: 0 0 0 3px #60a5fa;
  transform: scale(1.08);
}

.tile .letter {
  font-size: 1.6rem;
  font-weight: 800;
  color: #1a1a2e;
  line-height: 1;
}

.tile.blank-tile {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(226, 232, 240, 0.95));
  border-color: rgba(100, 116, 139, 0.4);
}

.tile.blank-tile .letter {
  color: #d97706;
  font-size: 1.7rem;
}

.tile .value {
  position: absolute;
  bottom: 3px;
  right: 5px;
  font-size: 0.7rem;
  color: #52525b;
  font-weight: 700;
  line-height: 1;
}

@media (max-width: 380px) {
  .mobile-rack-view {
    padding-left: max(4px, env(safe-area-inset-left));
    padding-right: max(4px, env(safe-area-inset-right));
  }
  .tiles {
    gap: 2px;
  }
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

/* ---- bottom action bar ---- */
.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 800;
  padding: 8px max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
  background: rgba(10, 14, 30, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.action-bar-inner {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  gap: 6px;
}

.action-btn {
  flex: 1 1 0;
  min-width: 0;
  min-height: var(--action-bar-height);
  padding: 6px 2px;
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  background: rgba(20, 20, 40, 0.6);
  color: #e4e4e7;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.1s ease, background 0.2s ease;
}

.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  box-shadow: none;
}

.action-btn:not(:disabled):active {
  transform: scale(0.95);
}

.btn-icon {
  font-size: 1.35rem;
  line-height: 1;
}

.btn-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.play-btn {
  flex-grow: 1.3;
  background: rgba(16, 185, 129, 0.35);
  border-color: rgba(16, 185, 129, 0.7);
  color: #d1fae5;
}

.recall-btn {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.45);
  color: #fde68a;
}

.shuffle-btn {
  background: rgba(236, 72, 153, 0.2);
  border-color: rgba(236, 72, 153, 0.45);
  color: #fbcfe8;
}

.exchange-btn {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.45);
  color: #bfdbfe;
}

.pass-btn {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.45);
  color: #ddd6fe;
}

.message-box {
  padding: 10px 12px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
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
