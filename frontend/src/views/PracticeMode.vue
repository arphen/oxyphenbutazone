<template>
  <div id="practice-mode">
    <!-- Category Selection View -->
    <div v-if="!selectedScenario" class="category-view">
      <div class="header">
        <button @click="goHome" class="back-button">← Back to Menu</button>
        <h1>Practice Mode</h1>
        <p class="subtitle">Choose a category to practice</p>
      </div>

      <div class="categories-grid">
        <div 
          v-for="(category, key) in categories" 
          :key="key"
          class="category-card"
          @click="selectCategory(key)"
        >
          <div class="category-icon">{{ category.icon }}</div>
          <h2>{{ category.name }}</h2>
          <p>{{ category.description }}</p>
          <div class="scenario-count">
            {{ getCategoryScenarioCount(key) }} {{ getCategoryScenarioCount(key) === 1 ? 'scenario' : 'scenarios' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Practice View -->
    <div v-else class="practice-view">
      <div class="practice-layout">
        <!-- Board Section -->
        <div class="board-section">
          <Board 
            :board="currentBoard" 
            @place-letter="handlePlaceLetter"
            @cell-click="handleCellClick"
          />
        </div>

        <!-- Sidebar -->
        <div class="sidebar">
          <!-- Header -->
          <div class="sidebar-header">
            <button @click="exitScenario" class="icon-button" title="Back to Categories">
              ←
            </button>
            <div class="scenario-info">
              <div class="scenario-title">{{ selectedScenario.title }}</div>
              <div class="difficulty-badge" :class="selectedScenario.difficulty">
                {{ selectedScenario.difficulty }}
              </div>
            </div>
          </div>

          <!-- Description -->
          <div class="description-section">
            <p>{{ selectedScenario.description }}</p>
            <div class="category-badge">
              {{ categories[selectedScenario.category].icon }}
              {{ categories[selectedScenario.category].name }}
            </div>
          </div>

          <!-- Rack -->
          <div class="rack-section">
            <h3>Your Rack</h3>
            <div class="rack">
              <div 
                v-for="(letter, index) in rack" 
                :key="`rack-${index}`"
                class="tile"
                :class="{ 'used': usedTiles.includes(index) }"
                draggable="true"
                @dragstart="handleDragStart($event, letter, index)"
                @dragend="handleDragEnd"
              >
                <span class="letter">{{ letter || '?' }}</span>
                <span class="value">{{ getLetterValue(letter) }}</span>
              </div>
            </div>
          </div>

          <!-- Feedback Section -->
          <div class="feedback-section" v-if="feedback">
            <div class="feedback-box" :class="feedback.type">
              <div class="feedback-icon">
                {{ feedback.type === 'success' ? '🎉' : feedback.type === 'error' ? '❌' : 'ℹ️' }}
              </div>
              <div class="feedback-content">
                <div class="feedback-title">{{ feedback.title }}</div>
                <div class="feedback-message">{{ feedback.message }}</div>
                <div v-if="feedback.score" class="feedback-score">
                  Score: {{ feedback.score }} points
                </div>
              </div>
            </div>
          </div>

          <!-- Hints Section -->
          <div class="hints-section" v-if="!showSolution">
            <h3>Hints</h3>
            <div class="hints-list">
              <div 
                v-for="(hint, index) in visibleHints" 
                :key="index"
                class="hint-item"
              >
                {{ hint }}
              </div>
              <button 
                v-if="visibleHints.length < selectedScenario.hints.length"
                @click="showNextHint"
                class="hint-button"
              >
                Show Next Hint ({{ visibleHints.length }}/{{ selectedScenario.hints.length }})
              </button>
            </div>
          </div>

          <!-- Solution Section -->
          <div class="solution-section" v-if="showSolution">
            <h3>Solution{{ selectedScenario.solutions.length > 1 ? 's' : '' }}</h3>
            <div 
              v-for="(solution, index) in selectedScenario.solutions" 
              :key="index"
              class="solution-item"
            >
              <div class="solution-word">{{ solution.word }}</div>
              <div class="solution-score">{{ solution.score }} points</div>
              <div class="solution-explanation">{{ solution.explanation }}</div>
              <button 
                @click="showSolutionOnBoard(solution)"
                class="show-solution-button"
              >
                Show on Board
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="actions-section">
            <button @click="checkSolution" class="action-button primary">
              ✓ Check My Solution
            </button>
            <button @click="resetBoard" class="action-button secondary">
              ↺ Reset Board
            </button>
            <button 
              @click="toggleSolution" 
              class="action-button secondary"
            >
              {{ showSolution ? '👁️ Hide' : '💡 Show' }} Solution
            </button>
            <button @click="nextScenario" class="action-button success">
              Next Scenario →
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Board from '../components/Board.vue';
import { 
  practiceCategories, 
  getScenariosByCategory,
  getRandomScenario 
} from '../data/practiceScenarios.js';
import { scenarioCells, evaluatePlay, findInvalidWords, findSolution, sameTiles } from '../data/practiceCheck.js';

export default {
  name: 'PracticeMode',
  components: {
    Board
  },
  data() {
    return {
      categories: practiceCategories,
      selectedCategory: null,
      selectedScenario: null,
      currentBoard: [],
      rack: [],
      usedTiles: [],
      draggedTile: null,
      draggedIndex: null,
      feedback: null,
      showSolution: false,
      visibleHints: [],
      placedTiles: [] // Track tiles placed by the player
    };
  },
  methods: {
    goHome() {
      this.$router.push('/');
    },

    getCategoryScenarioCount(categoryKey) {
      return getScenariosByCategory(categoryKey).length;
    },

    selectCategory(categoryKey) {
      this.selectedCategory = categoryKey;
      this.loadRandomScenario(categoryKey);
    },

    loadRandomScenario(categoryKey) {
      const scenario = getRandomScenario(categoryKey);
      if (scenario) {
        this.selectedScenario = scenario;
        this.initializeScenario();
      }
    },

    initializeScenario() {
      // A fresh copy of the board: the scenario's tiles are fixed, premium squares come from the real board layout
      this.currentBoard = scenarioCells(this.selectedScenario);

      // Clone the rack
      this.rack = [...this.selectedScenario.rack];
      this.usedTiles = [];
      this.placedTiles = [];
      this.feedback = null;
      this.showSolution = false;
      this.visibleHints = [];
    },

    handleDragStart(event, letter, index) {
      if (this.usedTiles.includes(index)) return;
      
      this.draggedTile = letter;
      this.draggedIndex = index;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({
        letter,
        from: 'rack',
        index
      }));
    },

    handleDragEnd() {
      this.draggedTile = null;
      this.draggedIndex = null;
    },

    handlePlaceLetter(data) {
      const { letter, from, index, toRowIndex, toColIndex, fromRowIndex, fromColIndex } = data;

      // Don't allow placing on original scenario tiles
      if (this.currentBoard[toRowIndex][toColIndex].isPracticeOriginal) {
        return;
      }

      if (from === 'rack') {
        // Placing from rack
        if (!this.currentBoard[toRowIndex][toColIndex].letter) {
          this.currentBoard[toRowIndex][toColIndex].letter = letter;
          this.currentBoard[toRowIndex][toColIndex].isNew = true;
          this.usedTiles.push(index);
          this.placedTiles.push({ row: toRowIndex, col: toColIndex, letter, rackIndex: index });
        }
      } else if (from === 'board') {
        // Moving tile on board (only allow moving player-placed tiles)
        if (!this.currentBoard[fromRowIndex][fromColIndex].isPracticeOriginal) {
          if (!this.currentBoard[toRowIndex][toColIndex].letter) {
            this.currentBoard[toRowIndex][toColIndex].letter = letter;
            this.currentBoard[toRowIndex][toColIndex].isNew = true;
            this.currentBoard[fromRowIndex][fromColIndex].letter = '';
            this.currentBoard[fromRowIndex][fromColIndex].isNew = false;
            
            // Update placedTiles tracking
            const tileIndex = this.placedTiles.findIndex(t => t.row === fromRowIndex && t.col === fromColIndex);
            if (tileIndex !== -1) {
              this.placedTiles[tileIndex].row = toRowIndex;
              this.placedTiles[tileIndex].col = toColIndex;
            }
          }
        }
      }

      this.currentBoard = [...this.currentBoard];
      this.feedback = null; // Clear feedback when tiles are moved
    },

    handleCellClick({ row, col }) {
      // Allow removing only player-placed tiles
      if (this.currentBoard[row][col].letter && !this.currentBoard[row][col].isPracticeOriginal) {
        // Find the tile in placedTiles
        const tileIndex = this.placedTiles.findIndex(t => t.row === row && t.col === col);
        if (tileIndex !== -1) {
          const tile = this.placedTiles[tileIndex];
          
          // Remove from board
          this.currentBoard[row][col].letter = '';
          this.currentBoard[row][col].isNew = false;
          
          // Return to rack
          const rackIndex = this.usedTiles.indexOf(tile.rackIndex);
          if (rackIndex !== -1) {
            this.usedTiles.splice(rackIndex, 1);
          }
          
          // Remove from placedTiles
          this.placedTiles.splice(tileIndex, 1);
          
          this.currentBoard = [...this.currentBoard];
        }
      }
    },

    getLetterValue(letter) {
      const values = {
        'A': 1, 'E': 1, 'I': 1, 'O': 1, 'U': 1, 'L': 1, 'N': 1, 'S': 1, 'T': 1, 'R': 1,
        'D': 2, 'G': 2,
        'B': 3, 'C': 3, 'M': 3, 'P': 3,
        'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
        'K': 5,
        'J': 8, 'X': 8,
        'Q': 10, 'Z': 10,
        '': 0
      };
      return values[letter] || 0;
    },

    async checkSolution() {
      if (this.placedTiles.length === 0) {
        this.feedback = {
          type: 'error',
          title: 'No tiles placed',
          message: 'Place some tiles on the board first!'
        };
        return;
      }

      // Is it a legal play, and which words does it make (the main word and every cross word)?
      const play = evaluatePlay(this.currentBoard);
      if (!play.ok) {
        this.feedback = { type: 'error', title: 'Not a legal play', message: play.message };
        return;
      }

      // Every word has to be in the word list this player is using
      let invalid;
      try {
        invalid = await findInvalidWords(play.words, async (word) => {
          const response = await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'validate-word', word })
          });
          return (await response.json()).valid === true;
        });
      } catch {
        this.feedback = { type: 'error', title: 'Could not check', message: 'The words could not be checked. Please try again.' };
        return;
      }
      if (invalid.length > 0) {
        this.feedback = {
          type: 'error',
          title: 'Not a word',
          message: `${invalid.join(', ')} ${invalid.length === 1 ? 'is' : 'are'} not in your word list, so this play is not allowed.`
        };
        return;
      }

      const matchingSolution = findSolution(this.selectedScenario, play.words);
      if (matchingSolution) {
        const exact = sameTiles(this.currentBoard, matchingSolution);
        this.feedback = {
          type: 'success',
          title: 'Correct! 🎉',
          message: exact
            ? matchingSolution.explanation
            : `You found ${matchingSolution.word}. ${matchingSolution.explanation}`,
          score: play.score
        };
        return;
      }

      // A valid play of your own: compare it with the best listed play
      const bestSolutionScore = Math.max(...this.selectedScenario.solutions.map(s => s.score));
      if (play.score >= bestSolutionScore * 0.9) {
        const longest = [...play.words].sort((a, b) => b.word.length - a.word.length)[0].word;
        this.feedback = {
          type: 'success',
          title: 'Good play!',
          message: `${longest} is a real word and your play scored ${play.score} points. That's a strong move!`,
          score: play.score
        };
      } else {
        this.feedback = {
          type: 'info',
          title: 'Not the optimal solution',
          message: `You scored ${play.score} points, but there's a better move worth ${bestSolutionScore} points. Try again or check the solution!`,
          score: play.score
        };
      }
    },

    resetBoard() {
      this.initializeScenario();
      this.feedback = null;
    },

    showNextHint() {
      if (this.visibleHints.length < this.selectedScenario.hints.length) {
        this.visibleHints.push(this.selectedScenario.hints[this.visibleHints.length]);
      }
    },

    toggleSolution() {
      this.showSolution = !this.showSolution;
    },

    showSolutionOnBoard(solution) {
      this.resetBoard();
      
      // Place solution tiles on board
      solution.tiles.forEach(tile => {
        const { letter, row, col } = tile;
        
        // Find this letter in rack
        const rackIndex = this.rack.findIndex((l, i) => l === letter && !this.usedTiles.includes(i));
        
        if (rackIndex !== -1 && !this.currentBoard[row][col].isPracticeOriginal) {
          this.currentBoard[row][col].letter = letter;
          this.currentBoard[row][col].isNew = true;
          this.usedTiles.push(rackIndex);
          this.placedTiles.push({ row, col, letter, rackIndex });
        }
      });
      
      this.currentBoard = [...this.currentBoard];
      
      this.feedback = {
        type: 'info',
        title: 'Solution shown',
        message: solution.explanation,
        score: solution.score
      };
    },

    nextScenario() {
      if (this.selectedCategory) {
        this.loadRandomScenario(this.selectedCategory);
      }
    },

    exitScenario() {
      this.selectedScenario = null;
      this.selectedCategory = null;
    }
  }
};
</script>

<style scoped>
#practice-mode {
  font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
  color: #e4e4e7;
}

/* Category Selection View */
.category-view {
  min-height: 100vh;
  padding: 40px 20px;
}

.header {
  text-align: center;
  margin-bottom: 50px;
}

.back-button {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e4e4e7;
  padding: 10px 20px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  border-radius: 6px;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateX(-5px);
}

.header h1 {
  font-size: 3.5rem;
  margin: 0 0 10px 0;
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  font-size: 1.3rem;
  color: #a1a1aa;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.categories-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
}

.category-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 30px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.category-card:hover {
  transform: translateY(-10px);
  border-color: rgba(96, 165, 250, 0.5);
  box-shadow: 0 20px 40px rgba(96, 165, 250, 0.2);
}

.category-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.category-card h2 {
  font-size: 1.5rem;
  margin: 0 0 15px 0;
  color: #e4e4e7;
}

.category-card p {
  color: #a1a1aa;
  line-height: 1.6;
  margin: 0 0 20px 0;
  min-height: 50px;
}

.scenario-count {
  color: #60a5fa;
  font-weight: 600;
  font-size: 0.9rem;
}

/* Practice View */
.practice-view {
  min-height: 100vh;
}

.practice-layout {
  display: flex;
  height: 100vh;
}

.board-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.sidebar {
  width: 420px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.3);
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
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
  border-radius: 6px;
}

.icon-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateX(-3px);
}

.scenario-info {
  flex: 1;
}

.scenario-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #e4e4e7;
  margin-bottom: 5px;
}

.difficulty-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.difficulty-badge.easy {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.difficulty-badge.medium {
  background: rgba(251, 146, 60, 0.2);
  color: #fdba74;
  border: 1px solid rgba(251, 146, 60, 0.4);
}

.difficulty-badge.hard {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.description-section {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.description-section p {
  color: #a1a1aa;
  line-height: 1.6;
  margin: 0 0 15px 0;
}

.category-badge {
  display: inline-block;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.3);
  color: #93c5fd;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.rack-section {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.rack-section h3 {
  margin: 0 0 15px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.rack {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.tile {
  width: 45px;
  height: 45px;
  background: linear-gradient(135deg, #f0e68c 0%, #daa520 100%);
  border: 2px solid #b8860b;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: grab;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  position: relative;
}

.tile:active {
  cursor: grabbing;
  transform: scale(0.95);
}

.tile.used {
  opacity: 0.3;
  cursor: not-allowed;
}

.tile .letter {
  font-size: 1.3rem;
  font-weight: 700;
  color: #2c1810;
  line-height: 1;
}

.tile .value {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  color: #2c1810;
}

.feedback-section {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.feedback-box {
  display: flex;
  gap: 15px;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.feedback-box.success {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.4);
}

.feedback-box.error {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.4);
}

.feedback-box.info {
  background: rgba(96, 165, 250, 0.1);
  border-color: rgba(96, 165, 250, 0.4);
}

.feedback-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.feedback-content {
  flex: 1;
}

.feedback-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 5px;
  color: #e4e4e7;
}

.feedback-message {
  color: #a1a1aa;
  line-height: 1.5;
  margin-bottom: 8px;
}

.feedback-score {
  color: #60a5fa;
  font-weight: 700;
  font-size: 1.1rem;
}

.hints-section, .solution-section {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.hints-section h3, .solution-section h3 {
  margin: 0 0 15px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.hints-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hint-item {
  background: rgba(251, 146, 60, 0.1);
  border: 1px solid rgba(251, 146, 60, 0.3);
  color: #fdba74;
  padding: 12px;
  border-radius: 6px;
  line-height: 1.5;
}

.hint-button {
  background: rgba(251, 146, 60, 0.2);
  border: 1px solid rgba(251, 146, 60, 0.4);
  color: #fdba74;
  padding: 10px 15px;
  cursor: pointer;
  border-radius: 6px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.hint-button:hover {
  background: rgba(251, 146, 60, 0.3);
}

.solution-item {
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.3);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 10px;
}

.solution-word {
  font-size: 1.5rem;
  font-weight: 700;
  color: #93c5fd;
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.solution-score {
  color: #60a5fa;
  font-weight: 700;
  margin-bottom: 10px;
}

.solution-explanation {
  color: #a1a1aa;
  line-height: 1.5;
  margin-bottom: 15px;
}

.show-solution-button {
  background: rgba(96, 165, 250, 0.2);
  border: 1px solid rgba(96, 165, 250, 0.4);
  color: #93c5fd;
  padding: 8px 15px;
  cursor: pointer;
  border-radius: 6px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.show-solution-button:hover {
  background: rgba(96, 165, 250, 0.3);
}

.actions-section {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-button {
  padding: 12px 20px;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.action-button.primary {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
}

.action-button.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(34, 197, 94, 0.3);
}

.action-button.secondary {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e4e4e7;
}

.action-button.secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.action-button.success {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
}

.action-button.success:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
}
</style>
