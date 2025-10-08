<template>
  <div id="app">
    <!-- Mobile View -->
    <MobileRackView v-if="isMobileView" />
    
    <!-- Main Game View -->
    <template v-else>
      <div class="desktop-layout">
        <!-- Board Section -->
        <div class="board-section">
          <Board :board="board" @place-letter="handlePlaceLetter" @cell-click="handleCellClick" />
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
              :rack="player1Rack"
              :score="player1Score"
              :isCurrentPlayer="currentPlayer === 1"
              :gameId="gameId" 
            />
            <QRDisplay 
              :playerId="2" 
              playerName="P2"
              :rack="player2Rack"
              :score="player2Score"
              :isCurrentPlayer="currentPlayer === 2"
              :gameId="gameId" 
            />
          </div>
          
          <!-- Players Info -->
          <div class="players-container">
            <div class="player-card" :class="{ active: currentPlayer === 1 }">
              <div class="player-name">P1</div>
              <div class="player-score">{{ player1Score }}</div>
            </div>
            <div class="player-card" :class="{ active: currentPlayer === 2 }">
              <div class="player-name">P2</div>
              <div class="player-score">{{ player2Score }}</div>
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
                    <span v-if="entry.action === 'exchange'">
                      Exchanged {{ entry.tilesExchanged }}
                    </span>
                    <span v-else>{{ entry.words.map(w => w.word).join(', ') }}</span>
                  </td>
                  <td class="score-cell">
                    <span v-if="entry.action !== 'exchange'">+{{ entry.totalScore }}</span>
                    <span v-else>—</span>
                  </td>
                </tr>
                <tr v-if="combinedHistory.length === 0">
                  <td colspan="4" class="no-history">No moves yet</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Controls -->
          <div class="controls-section">
            <Controls 
              @play-move="handlePlayMove" 
              @clear-board="handleClearBoard"
              @exchange="handleExchange"
              :currentRack="currentRack"
              :message="message"
              :messageType="messageType"
              :previewScore="previewScore" />
          </div>
        </div>
      </div>
    
      <ScoreHistoryModal
        :isVisible="showScoreModal"
        :player1History="player1History"
        :player2History="player2History"
        :player1TotalScore="player1Score"
        :player2TotalScore="player2Score"
        :activePlayer="modalPlayer"
        @close="closeModal"
      />
    </template>
  </div>
</template>

<script>
import Board from '../components/Board.vue';
import Controls from '../components/Controls.vue';
import ScoreHistoryModal from '../components/ScoreHistoryModal.vue';
import QRDisplay from '../components/QRDisplay.vue';
import MobileRackView from '../components/MobileRackView.vue';

export default {
  name: 'App',
  components: {
    Board,
    Controls,
    ScoreHistoryModal,
    QRDisplay,
    MobileRackView,
  },
  data() {
    return {
      board: this.createInitialBoard(),
      player1Rack: [],
      player2Rack: [],
      player1Score: 0,
      player2Score: 0,
      player1History: [],
      player2History: [],
      tileBag: [],
      currentPlayer: 1,
      dictionary: new Set(),
      message: '',
      messageType: '',
      placedTiles: [],
      showScoreModal: false,
      modalPlayer: null,
      gameId: '',
      showQR: false,
      isMobileView: false,
      viewportCenter: { row: 7, col: 7 }, // Center of 15x15 board
      pollInterval: null,
    };
  },
  computed: {
    currentRack() {
      return this.currentPlayer === 1 ? this.player1Rack : this.player2Rack;
    },
    combinedHistory() {
      // Combine both player histories into a single chronological list
      const combined = [];
      const maxLength = Math.max(this.player1History.length, this.player2History.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (this.player1History[i]) {
          combined.push({
            ...this.player1History[i],
            player: 1,
            round: i + 1,
            result: this.player1History[i].action === 'exchange' ? 'exchange-row' : 'valid-row'
          });
        }
        if (this.player2History[i]) {
          combined.push({
            ...this.player2History[i],
            player: 2,
            round: i + 1,
            result: this.player2History[i].action === 'exchange' ? 'exchange-row' : 'valid-row'
          });
        }
      }
      
      return combined;
    },
    previewScore() {
      if (this.placedTiles.length === 0) {
        return null;
      }
      
      const words = this.getWordsFromBoard();
      
      // Filter words that contain at least one newly placed tile
      const newWords = words.filter(wordObj => 
        wordObj.tiles.some(tile => tile.isNew)
      );
      
      if (newWords.length === 0) {
        return null;
      }
      
      // Calculate total score (assuming all words are valid)
      let totalScore = 0;
      const wordScores = newWords.map(wordObj => {
        const score = this.calculateWordScore(wordObj);
        totalScore += score;
        return { word: wordObj.word, score };
      });
      
      // Add bonus for using all 7 tiles (bingo)
      const bingoBonus = this.placedTiles.length === 7 ? 50 : 0;
      totalScore += bingoBonus;
      
      return {
        totalScore,
        wordScores,
        bingoBonus,
        words: newWords.map(w => w.word)
      };
    }
  },
  async mounted() {
    // Check if this is a mobile view
    const urlParams = new URLSearchParams(window.location.search);
    this.isMobileView = urlParams.get('view') === 'mobile';
    
    if (!this.isMobileView) {
      // Generate or load game ID
      this.gameId = this.generateGameId();
      
      await this.loadDictionary();
      this.initializeTileBag();
      this.fillRack(1);
      this.fillRack(2);
      
      // Sync game state to localStorage
      this.syncGameState();
      
      // Poll for updates from mobile devices every 2 seconds
      this.pollInterval = setInterval(() => {
        this.fetchGameStateFromAPI();
      }, 2000);
    }
  },
  beforeUnmount() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  },
  methods: {
    getLetterValue(letter) {
      // Standard Scrabble letter point values
      const values = {
        'a': 1, 'e': 1, 'i': 1, 'o': 1, 'u': 1, 'l': 1, 'n': 1, 's': 1, 't': 1, 'r': 1,
        'd': 2, 'g': 2,
        'b': 3, 'c': 3, 'm': 3, 'p': 3,
        'f': 4, 'h': 4, 'v': 4, 'w': 4, 'y': 4,
        'k': 5,
        'j': 8, 'x': 8,
        'q': 10, 'z': 10,
        '': 0  // blank tile
      };
      return values[letter.toLowerCase()] || 0;
    },
    calculateWordScore(wordObj) {
      let score = 0;
      let wordMultiplier = 1;
      
      wordObj.tiles.forEach(tile => {
        const { row, col, isNew } = tile;
        const letter = this.board[row][col].letter;
        const squareType = this.board[row][col].type;
        let letterValue = this.getLetterValue(letter);
        
        // Only apply premium squares if the tile was newly placed this turn
        if (isNew) {
          if (squareType === 'dl') {
            letterValue *= 2;
          } else if (squareType === 'tl') {
            letterValue *= 3;
          } else if (squareType === 'dw' || squareType === 'center') {
            wordMultiplier *= 2;
          } else if (squareType === 'tw') {
            wordMultiplier *= 3;
          }
        }
        
        score += letterValue;
      });
      
      score *= wordMultiplier;
      return score;
    },
    async loadDictionary() {
      try {
        const response = await fetch('/sowpods.txt');
        const text = await response.text();
        const words = text.split('\n').map(word => word.trim().toUpperCase()).filter(word => word.length > 0);
        this.dictionary = new Set(words);
        console.log(`Dictionary loaded: ${this.dictionary.size} words`);
      } catch (error) {
        console.error('Failed to load dictionary:', error);
        this.message = 'Failed to load dictionary';
        this.messageType = 'error';
      }
    },
    initializeTileBag() {
      // Standard Scrabble letter distribution (100 tiles total)
      const letterDistribution = [
        { letter: 'e', count: 12 },
        { letter: 'a', count: 9 },
        { letter: 'i', count: 9 },
        { letter: 'o', count: 8 },
        { letter: 'n', count: 6 },
        { letter: 'r', count: 6 },
        { letter: 't', count: 6 },
        { letter: 'l', count: 4 },
        { letter: 's', count: 4 },
        { letter: 'u', count: 4 },
        { letter: 'd', count: 4 },
        { letter: 'g', count: 3 },
        { letter: 'b', count: 2 },
        { letter: 'c', count: 2 },
        { letter: 'm', count: 2 },
        { letter: 'p', count: 2 },
        { letter: 'f', count: 2 },
        { letter: 'h', count: 2 },
        { letter: 'v', count: 2 },
        { letter: 'w', count: 2 },
        { letter: 'y', count: 2 },
        { letter: 'k', count: 1 },
        { letter: 'j', count: 1 },
        { letter: 'x', count: 1 },
        { letter: 'q', count: 1 },
        { letter: 'z', count: 1 },
        { letter: '', count: 2 }, // blank tiles
      ];
      
      // Build tile bag
      this.tileBag = [];
      letterDistribution.forEach(({ letter, count }) => {
        for (let i = 0; i < count; i++) {
          this.tileBag.push(letter);
        }
      });
      
      // Shuffle the bag
      this.shuffleTileBag();
      console.log(`Tile bag initialized with ${this.tileBag.length} tiles`);
    },
    shuffleTileBag() {
      // Fisher-Yates shuffle
      for (let i = this.tileBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.tileBag[i], this.tileBag[j]] = [this.tileBag[j], this.tileBag[i]];
      }
    },
    drawTileFromBag() {
      if (this.tileBag.length > 0) {
        return this.tileBag.pop();
      }
      return null;
    },
    returnTilesToBag(tiles) {
      // Return tiles to bag and shuffle
      this.tileBag.push(...tiles);
      this.shuffleTileBag();
    },
    fillRack(player) {
      // Fill specified player's rack up to 7 tiles
      const rack = player === 1 ? this.player1Rack : this.player2Rack;
      while (rack.length < 7 && this.tileBag.length > 0) {
        const tile = this.drawTileFromBag();
        if (tile !== null) {
          rack.push(tile);
        }
      }
      console.log(`Player ${player} rack filled. Rack: ${rack.length} tiles, Bag: ${this.tileBag.length} tiles remaining`);
    },
    createInitialBoard() {
      const board = Array(15).fill(null).map(() => Array(15).fill(null).map(() => ({ letter: '', type: '', isNew: false })));

      const specialSquares = {
        tw: [[0,0], [0,7], [0,14], [7,0], [7,14], [14,0], [14,7], [14,14]],
        dw: [[1,1], [2,2], [3,3], [4,4], [1,13], [2,12], [3,11], [4,10], [13,1], [12,2], [11,3], [10,4], [13,13], [12,12], [11,11], [10,10]],
        tl: [[1,5], [1,9], [5,1], [5,5], [5,9], [5,13], [9,1], [9,5], [9,9], [9,13], [13,5], [13,9]],
        dl: [[0,3], [0,11], [2,6], [2,8], [3,0], [3,7], [3,14], [6,2], [6,6], [6,8], [6,12], [7,3], [7,11], [8,2], [8,6], [8,8], [8,12], [11,0], [11,7], [11,14], [12,6], [12,8], [14,3], [14,11]],
      };

      for (const type in specialSquares) {
        specialSquares[type].forEach(([r, c]) => {
          board[r][c].type = type;
        });
      }

      board[7][7].type = 'center';
      return board;
    },
    handlePlaceLetter(data) {
      const { letter, from, index, toRowIndex, toColIndex, fromRowIndex, fromColIndex } = data;

      if (this.board[toRowIndex][toColIndex].letter) {
        return;
      }

      if (from === 'rack') {
        const rack = this.currentPlayer === 1 ? this.player1Rack : this.player2Rack;
        this.board[toRowIndex][toColIndex].letter = letter;
        this.board[toRowIndex][toColIndex].isNew = true;
        rack.splice(index, 1);
        this.placedTiles.push({ row: toRowIndex, col: toColIndex });
      } else if (from === 'board') {
        this.board[toRowIndex][toColIndex].letter = letter;
        this.board[toRowIndex][toColIndex].isNew = this.board[fromRowIndex][fromColIndex].isNew;
        this.board[fromRowIndex][fromColIndex].letter = '';
        this.board[fromRowIndex][fromColIndex].isNew = false;
        
        const tileIndex = this.placedTiles.findIndex(t => t.row === fromRowIndex && t.col === fromColIndex);
        if (tileIndex !== -1) {
          this.placedTiles[tileIndex] = { row: toRowIndex, col: toColIndex };
        }
      }
      
      this.message = '';
      this.messageType = '';
    },
    handleReturnLetter(data) {
      const { letter, fromRowIndex, fromColIndex } = data;
      const rack = this.currentPlayer === 1 ? this.player1Rack : this.player2Rack;
      rack.push(letter);
      this.board[fromRowIndex][fromColIndex].letter = '';
      this.board[fromRowIndex][fromColIndex].isNew = false;
      
      const tileIndex = this.placedTiles.findIndex(t => t.row === fromRowIndex && t.col === fromColIndex);
      if (tileIndex !== -1) {
        this.placedTiles.splice(tileIndex, 1);
      }
    },
    getWordsFromBoard() {
      const words = [];
      
      // Check horizontal words
      for (let row = 0; row < 15; row++) {
        let word = '';
        let wordTiles = [];
        for (let col = 0; col < 15; col++) {
          if (this.board[row][col].letter) {
            word += this.board[row][col].letter;
            wordTiles.push({ row, col, isNew: this.board[row][col].isNew });
          } else {
            if (word.length > 1) {
              words.push({ word: word.toUpperCase(), tiles: wordTiles });
            }
            word = '';
            wordTiles = [];
          }
        }
        if (word.length > 1) {
          words.push({ word: word.toUpperCase(), tiles: wordTiles });
        }
      }
      
      // Check vertical words
      for (let col = 0; col < 15; col++) {
        let word = '';
        let wordTiles = [];
        for (let row = 0; row < 15; row++) {
          if (this.board[row][col].letter) {
            word += this.board[row][col].letter;
            wordTiles.push({ row, col, isNew: this.board[row][col].isNew });
          } else {
            if (word.length > 1) {
              words.push({ word: word.toUpperCase(), tiles: wordTiles });
            }
            word = '';
            wordTiles = [];
          }
        }
        if (word.length > 1) {
          words.push({ word: word.toUpperCase(), tiles: wordTiles });
        }
      }
      
      return words;
    },
    handlePlayMove() {
      if (this.placedTiles.length === 0) {
        this.message = 'No tiles placed!';
        this.messageType = 'error';
        return;
      }
      
      // Check if this is the first move (no locked tiles on board)
      const hasLockedTiles = this.board.some(row => 
        row.some(cell => cell.letter && !cell.isNew)
      );
      
      if (!hasLockedTiles) {
        // First move must use center square (7, 7)
        const usesCenterSquare = this.placedTiles.some(tile => 
          tile.row === 7 && tile.col === 7
        );
        
        if (!usesCenterSquare) {
          this.message = 'First word must use the center square (★)!';
          this.messageType = 'error';
          return;
        }
      }
      
      const words = this.getWordsFromBoard();
      
      // Filter words that contain at least one newly placed tile
      const newWords = words.filter(wordObj => 
        wordObj.tiles.some(tile => tile.isNew)
      );
      
      if (newWords.length === 0) {
        this.message = 'No valid words formed!';
        this.messageType = 'error';
        return;
      }
      
      // Check all words against dictionary
      const invalidWords = newWords.filter(wordObj => !this.dictionary.has(wordObj.word));
      
      if (invalidWords.length > 0) {
        this.message = `Invalid word(s): ${invalidWords.map(w => w.word).join(', ')}`;
        this.messageType = 'error';
        
        // Save invalid attempt to history
        const turnData = {
          turnNumber: (this.currentPlayer === 1 ? this.player1History.length : this.player2History.length) + 1,
          action: 'invalid',
          words: invalidWords.map(w => ({ word: w.word, score: 0 })),
          totalScore: 0,
          timestamp: new Date().toLocaleTimeString(),
        };
        
        if (this.currentPlayer === 1) {
          this.player1History.push(turnData);
        } else {
          this.player2History.push(turnData);
        }
        
        // Return invalid tiles to player's rack
        const tilesToReturn = [];
        this.placedTiles.forEach(tile => {
          const letter = this.board[tile.row][tile.col].letter;
          tilesToReturn.push(letter);
          this.board[tile.row][tile.col].letter = '';
          this.board[tile.row][tile.col].isNew = false;
        });
        
        // Add tiles back to current player's rack
        if (this.currentPlayer === 1) {
          this.player1Rack.push(...tilesToReturn);
        } else {
          this.player2Rack.push(...tilesToReturn);
        }
        
        this.placedTiles = [];
        
        // Sync state so mobile sees the updated rack
        this.syncGameState();
      } else {
        // Calculate total score for all words
        let totalScore = 0;
        const wordScores = newWords.map(wordObj => {
          const score = this.calculateWordScore(wordObj);
          totalScore += score;
          return { word: wordObj.word, score };
        });
        
        // Add bonus for using all 7 tiles (bingo)
        const bingoBonus = this.placedTiles.length === 7 ? 50 : 0;
        totalScore += bingoBonus;
        
        // Save to history
        const turnData = {
          turnNumber: (this.currentPlayer === 1 ? this.player1History.length : this.player2History.length) + 1,
          words: wordScores,
          bingoBonus: bingoBonus,
          totalScore: totalScore,
          timestamp: new Date().toLocaleTimeString(),
        };
        
        if (this.currentPlayer === 1) {
          this.player1History.push(turnData);
          this.player1Score += totalScore;
        } else {
          this.player2History.push(turnData);
          this.player2Score += totalScore;
        }
        
        // Create detailed message
        const wordDetails = wordScores.map(ws => `${ws.word} (${ws.score})`).join(', ');
        const bonusText = bingoBonus ? ' +50 BINGO!' : '';
        this.message = `Valid! ${wordDetails}${bonusText} = ${totalScore} points`;
        this.messageType = 'success';
        
        // Lock placed tiles
        this.placedTiles.forEach(tile => {
          this.board[tile.row][tile.col].isNew = false;
        });
        this.placedTiles = [];
        
        // Refill current player's rack from bag
        this.fillRack(this.currentPlayer);
        
        console.log('[Desktop] 🎁 Refilled player', this.currentPlayer, 'rack to', this.currentPlayer === 1 ? this.player1Rack.length : this.player2Rack.length, 'tiles');
        
        // Switch to other player
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        
        // Sync state so mobile sees the updated racks, board, and turn
        // Use force=true to skip API rack check since we just refilled locally
        this.syncGameState(true);
      }
    },
    handleClearBoard() {
      // Return all new tiles to current player's rack
      const tilesToReturn = [];
      this.placedTiles.forEach(tile => {
        const letter = this.board[tile.row][tile.col].letter;
        tilesToReturn.push(letter);
        this.board[tile.row][tile.col].letter = '';
        this.board[tile.row][tile.col].isNew = false;
      });
      
      // Add tiles back to current player's rack
      if (this.currentPlayer === 1) {
        this.player1Rack.push(...tilesToReturn);
      } else {
        this.player2Rack.push(...tilesToReturn);
      }
      
      this.placedTiles = [];
      this.message = '';
      this.messageType = '';
      
      // Sync state so mobile sees the updated rack
      this.syncGameState();
    },
    handleExchange(tilesToExchange) {
      if (this.placedTiles.length > 0) {
        this.message = 'Cannot exchange tiles with tiles placed on board. Clear the board first.';
        this.messageType = 'error';
        return;
      }
      
      if (tilesToExchange.length === 0) {
        this.message = 'Select tiles to exchange';
        this.messageType = 'error';
        return;
      }
      
      if (this.tileBag.length < tilesToExchange.length) {
        this.message = `Not enough tiles in bag to exchange (${this.tileBag.length} remaining)`;
        this.messageType = 'error';
        return;
      }
      
      // Return selected tiles to bag
      this.returnTilesToBag(tilesToExchange);
      
      // Remove exchanged tiles from current player's rack
      const currentRack = this.currentPlayer === 1 ? this.player1Rack : this.player2Rack;
      tilesToExchange.forEach(tile => {
        const index = currentRack.indexOf(tile);
        if (index !== -1) {
          currentRack.splice(index, 1);
        }
      });
      
      // Draw new tiles
      this.fillRack(this.currentPlayer);
      
      // Record exchange in history
      const turnData = {
        turnNumber: (this.currentPlayer === 1 ? this.player1History.length : this.player2History.length) + 1,
        action: 'exchange',
        tilesExchanged: tilesToExchange.length,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      if (this.currentPlayer === 1) {
        this.player1History.push(turnData);
      } else {
        this.player2History.push(turnData);
      }
      
      this.message = `Exchanged ${tilesToExchange.length} tile(s)`;
      this.messageType = 'success';
      
      // Switch to other player - exchange ends turn
      this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
      
      // Sync state
      this.syncGameState(true);
    },
    showPlayerHistory(player) {
      this.modalPlayer = player;
      this.showScoreModal = true;
    },
    closeModal() {
      this.showScoreModal = false;
      this.modalPlayer = null;
    },
    generateGameId() {
      // Generate a short random game ID
      return Math.random().toString(36).substring(2, 8).toUpperCase();
    },
    async syncGameState(forceLocalRacks = false) {
      // First, fetch current API state to check for tiles placed from mobile
      let apiPlayer1Rack = this.player1Rack;
      let apiPlayer2Rack = this.player2Rack;
      
      if (!forceLocalRacks) {
        try {
          const response = await fetch('/api/rack/1');
          if (response.ok) {
            const data = await response.json();
            // If API has a different rack length, it means tiles were placed from mobile
            // Use the API's rack instead of our local one
            if (data.rack.length !== this.player1Rack.length) {
              apiPlayer1Rack = data.rack;
            }
            
            // Also check player 2
            const response2 = await fetch('/api/rack/2');
            if (response2.ok) {
              const data2 = await response2.json();
              if (data2.rack.length !== this.player2Rack.length) {
                apiPlayer2Rack = data2.rack;
              }
            }
          }
        } catch (error) {
          // If fetch fails, use local racks
        }
      }
      
      // Prepare game data
      const gameData = {
        board: this.board,
        viewportCenter: this.viewportCenter,
        player1: {
          playerName: 'Player 1',
          rack: apiPlayer1Rack,
          score: this.player1Score,
          isCurrentPlayer: this.currentPlayer === 1
        },
        player2: {
          playerName: 'Player 2',
          rack: apiPlayer2Rack,
          score: this.player2Score,
          isCurrentPlayer: this.currentPlayer === 2
        }
      };
      
      // Save to localStorage (backup)
      localStorage.setItem(`scrabble_game_${this.gameId}`, JSON.stringify(gameData));
      
      // Send to API for network access
      try {
        await fetch('/api/game-state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(gameData)
        });
      } catch (error) {
        console.error('Failed to sync game state:', error);
      }
    },
    async fetchGameStateFromAPI() {
      try {
        // Fetch player 1 data to get the board state and pending requests
        const response = await fetch('/api/rack/1');
        if (response.ok) {
          const data = await response.json();
          
          // Check for pending play request from mobile
          if (data.pendingPlayRequest) {
            console.log('[Desktop] 🎮 Processing play request from player:', data.pendingPlayRequest);
            await this.handleMobilePlayRequest(data.pendingPlayRequest);
            console.log('[Desktop] ✅ Play request completed');
            
            // Clear the pending request
            await fetch('/api/clear-play-request', { method: 'POST' });
            console.log('[Desktop] 🧹 Cleared pending request');
          }
          
          // Update board if it changed (check if tiles were placed from mobile)
          if (data.board && data.board.length > 0) {
            // Only update if there are differences
            let hasChanges = false;
            for (let row = 0; row < 15; row++) {
              for (let col = 0; col < 15; col++) {
                if (this.board[row][col].letter !== data.board[row][col].letter) {
                  hasChanges = true;
                  break;
                }
              }
              if (hasChanges) break;
            }
            
            if (hasChanges) {
              this.board = data.board;
            }
          }
        }
      } catch (error) {
        // Silently fail - don't spam console
      }
    },
    async handleMobilePlayRequest(playerId) {
      console.log('[Desktop] 📥 Syncing board and racks from API...');
      
      // Sync board state and racks from API first
      const apiData = await (await fetch('/api/rack/1')).json();
      this.board = apiData.board;
      
      // Also sync the racks from API so we have the current state
      const apiData2 = await (await fetch('/api/rack/2')).json();
      this.player1Rack = apiData.rack;
      this.player2Rack = apiData2.rack;
      
      console.log('[Desktop] 📊 Player 1 rack:', this.player1Rack);
      console.log('[Desktop] 📊 Player 2 rack:', this.player2Rack);
      
      // Find all new tiles on board
      const newTiles = [];
      for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
          if (this.board[row][col].isNew) {
            newTiles.push({ row, col, letter: this.board[row][col].letter });
          }
        }
      }
      
      console.log('[Desktop] 🎯 Found', newTiles.length, 'new tiles on board');
      
      if (newTiles.length === 0) {
        this.message = 'No tiles placed!';
        this.messageType = 'error';
        console.log('[Desktop] ❌ No tiles to play!');
        return;
      }
      
      // Set placedTiles so validation works
      this.placedTiles = newTiles;
      console.log('[Desktop] 🔍 Validating word...');
      
      // Use the existing handlePlayMove method
      this.handlePlayMove();
    },
    toggleQR() {
      this.showQR = !this.showQR;
    },
    async restartGame() {
      if (!confirm('Are you sure you want to restart the game? All progress will be lost.')) {
        return;
      }
      
      // Reset all game state
      this.board = this.createInitialBoard();
      this.player1Rack = [];
      this.player2Rack = [];
      this.player1Score = 0;
      this.player2Score = 0;
      this.player1History = [];
      this.player2History = [];
      this.currentPlayer = 1;
      this.placedTiles = [];
      this.message = '';
      this.messageType = '';
      this.viewportCenter = { row: 7, col: 7 };
      
      // Reinitialize tile bag and fill racks
      this.initializeTileBag();
      this.fillRack(1);
      this.fillRack(2);
      
      // Force sync to API without checking API state first
      const gameData = {
        board: this.board,
        viewportCenter: this.viewportCenter,
        player1: {
          playerName: 'Player 1',
          rack: this.player1Rack,
          score: this.player1Score,
          isCurrentPlayer: this.currentPlayer === 1
        },
        player2: {
          playerName: 'Player 2',
          rack: this.player2Rack,
          score: this.player2Score,
          isCurrentPlayer: this.currentPlayer === 2
        }
      };
      
      localStorage.setItem(`scrabble_game_${this.gameId}`, JSON.stringify(gameData));
      
      try {
        await fetch('/api/game-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gameData)
        });
      } catch (error) {
        console.error('Failed to sync restart:', error);
      }
      
      this.message = 'Game restarted!';
      this.messageType = 'success';
    },
    handleCellClick({ row, col }) {
      // Update viewport center to clicked cell
      this.viewportCenter = { row, col };
      // Sync immediately so mobile views update
      this.syncGameState();
    },
  },
  watch: {
    // Sync whenever game state changes
    player1Rack: {
      handler() {
        if (!this.isMobileView) this.syncGameState();
      },
      deep: true,
    },
    player2Rack: {
      handler() {
        if (!this.isMobileView) this.syncGameState();
      },
      deep: true,
    },
    player1Score() {
      if (!this.isMobileView) this.syncGameState();
    },
    player2Score() {
      if (!this.isMobileView) this.syncGameState();
    },
    currentPlayer() {
      if (!this.isMobileView) this.syncGameState();
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
}

.desktop-layout {
  display: flex;
  min-height: 100vh;
  gap: 0;
}

.board-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
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

.controls-section {
  padding: 20px 15px;
  background: rgba(0, 0, 0, 0.2);
}
</style>
