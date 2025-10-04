<template>
  <div id="app">
    <!-- Mobile View -->
    <MobileRackView v-if="isMobileView" />
    
    <!-- Main Game View -->
    <template v-else>
      <div class="game-header">
        <h1>Scrabble Trainer</h1>
        <button @click="toggleQR" class="qr-toggle-button">
          {{ showQR ? '🎮 Hide QR Codes' : '📱 Show QR Codes' }}
        </button>
      </div>
      
      <div v-if="showQR" class="qr-section">
        <QRDisplay 
          :playerId="1" 
          playerName="Player 1"
          :rack="player1Rack"
          :score="player1Score"
          :isCurrentPlayer="currentPlayer === 1"
          :gameId="gameId" 
        />
        <QRDisplay 
          :playerId="2" 
          playerName="Player 2"
          :rack="player2Rack"
          :score="player2Score"
          :isCurrentPlayer="currentPlayer === 2"
          :gameId="gameId" 
        />
      </div>
      
      <div class="game-container">
        <div class="player-section">
          <h2 :class="{ active: currentPlayer === 1 }">Player 1</h2>
          <div class="score clickable" @click="showPlayerHistory(1)">
            Score: {{ player1Score }}
            <span class="click-hint">📊</span>
          </div>
          <Rack :letters="player1Rack" @return-letter="handleReturnLetter" :disabled="currentPlayer !== 1" />
        </div>
        <div class="board-section">
          <Board :board="board" @place-letter="handlePlaceLetter" @cell-click="handleCellClick" />
          <Controls 
            @play-move="handlePlayMove" 
            @clear-board="handleClearBoard"
            :message="message"
            :messageType="messageType"
            :previewScore="previewScore" />
        </div>
        <div class="player-section">
          <h2 :class="{ active: currentPlayer === 2 }">Player 2</h2>
          <div class="score clickable" @click="showPlayerHistory(2)">
            Score: {{ player2Score }}
            <span class="click-hint">📊</span>
          </div>
          <Rack :letters="player2Rack" @return-letter="handleReturnLetter" :disabled="currentPlayer !== 2" />
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
import Rack from '../components/Rack.vue';
import Controls from '../components/Controls.vue';
import ScoreHistoryModal from '../components/ScoreHistoryModal.vue';
import QRDisplay from '../components/QRDisplay.vue';
import MobileRackView from '../components/MobileRackView.vue';

export default {
  name: 'App',
  components: {
    Board,
    Rack,
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
    };
  },
  computed: {
    currentRack() {
      return this.currentPlayer === 1 ? this.player1Rack : this.player2Rack;
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
        
        // Return invalid tiles to bag
        const tilesToReturn = [];
        this.placedTiles.forEach(tile => {
          const letter = this.board[tile.row][tile.col].letter;
          tilesToReturn.push(letter);
          this.board[tile.row][tile.col].letter = '';
          this.board[tile.row][tile.col].isNew = false;
        });
        this.returnTilesToBag(tilesToReturn);
        this.placedTiles = [];
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
        
        // Switch to other player
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
      }
    },
    handleClearBoard() {
      // Return all new tiles to bag
      const tilesToReturn = [];
      this.placedTiles.forEach(tile => {
        const letter = this.board[tile.row][tile.col].letter;
        tilesToReturn.push(letter);
        this.board[tile.row][tile.col].letter = '';
        this.board[tile.row][tile.col].isNew = false;
      });
      this.returnTilesToBag(tilesToReturn);
      this.placedTiles = [];
      this.message = '';
      this.messageType = '';
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
    async syncGameState() {
      // Prepare game data
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
    toggleQR() {
      this.showQR = !this.showQR;
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
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  padding: 20px;
}

.game-header {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.game-header h1 {
  margin: 0;
}

.qr-toggle-button {
  padding: 10px 20px;
  font-size: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.qr-toggle-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
}

.qr-section {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 15px;
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

.game-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 30px;
  max-width: 1400px;
  margin: 0 auto;
}

.player-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.player-section h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #666;
  transition: all 0.3s ease;
}

.player-section h2.active {
  color: #4CAF50;
  font-weight: bold;
  font-size: 1.8rem;
}

.score {
  font-size: 1.3rem;
  font-weight: bold;
  color: #2c3e50;
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  min-width: 150px;
  position: relative;
  transition: all 0.3s ease;
}

.score.clickable {
  cursor: pointer;
}

.score.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
}

.click-hint {
  margin-left: 8px;
  font-size: 1rem;
  opacity: 0.8;
}

.board-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
</style>
