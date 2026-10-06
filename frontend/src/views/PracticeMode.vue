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
          <!-- why: data icons are emoji; render the category initial instead so no emoji ships -->
          <div class="category-icon" aria-hidden="true">{{ category.name.charAt(0) }}</div>
          <h2>{{ category.name }}</h2>
          <p>{{ category.description }}</p>
          <div class="scenario-count">
            {{ getCategoryScenarioCount(key) }}
            {{ getCategoryScenarioCount(key) === 1 ? 'scenario' : 'scenarios' }}
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
            <button @click="exitScenario" class="icon-button" title="Back to Categories">←</button>
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
              {{ categories[selectedScenario.category].name }}
            </div>
          </div>

          <!-- Rack -->
          <div class="rack-section">
            <h3>Rack</h3>
            <div class="rack">
              <div
                v-for="(letter, index) in rack"
                :key="`rack-${index}`"
                class="tile"
                :class="{ used: usedTiles.includes(index) }"
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
              <!-- why: plain text glyphs (not emoji) mark validation state; color comes from --success/--danger/--accent -->
              <div class="feedback-icon" aria-hidden="true">
                {{ feedback.type === 'success' ? '✓' : feedback.type === 'error' ? '×' : 'i' }}
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
              <div v-for="(hint, index) in visibleHints" :key="index" class="hint-item">
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
              <button @click="showSolutionOnBoard(solution)" class="show-solution-button">
                Show on Board
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="actions-section">
            <button @click="checkSolution" class="action-button primary">Check solution</button>
            <button @click="resetBoard" class="action-button secondary">↺ Reset Board</button>
            <button @click="toggleSolution" class="action-button secondary">
              {{ showSolution ? 'Hide' : 'Show' }} solution
            </button>
            <button @click="nextScenario" class="action-button success">Next Scenario →</button>
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
  getRandomScenario,
} from '../data/practiceScenarios.js';
import {
  scenarioCells,
  evaluatePlay,
  findInvalidWords,
  findSolution,
  sameTiles,
} from '../data/practiceCheck.js';

export default {
  name: 'PracticeMode',
  components: {
    Board,
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
      placedTiles: [], // Track tiles placed by the player
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
      event.dataTransfer.setData(
        'text/plain',
        JSON.stringify({
          letter,
          from: 'rack',
          index,
        })
      );
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
            const tileIndex = this.placedTiles.findIndex(
              (t) => t.row === fromRowIndex && t.col === fromColIndex
            );
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
        const tileIndex = this.placedTiles.findIndex((t) => t.row === row && t.col === col);
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
        A: 1,
        E: 1,
        I: 1,
        O: 1,
        U: 1,
        L: 1,
        N: 1,
        S: 1,
        T: 1,
        R: 1,
        D: 2,
        G: 2,
        B: 3,
        C: 3,
        M: 3,
        P: 3,
        F: 4,
        H: 4,
        V: 4,
        W: 4,
        Y: 4,
        K: 5,
        J: 8,
        X: 8,
        Q: 10,
        Z: 10,
        '': 0,
      };
      return values[letter] || 0;
    },

    async checkSolution() {
      if (this.placedTiles.length === 0) {
        this.feedback = {
          type: 'error',
          title: 'No tiles placed',
          message: 'Place tiles on the board first.',
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
            body: JSON.stringify({ type: 'validate-word', word }),
          });
          return (await response.json()).valid === true;
        });
      } catch {
        this.feedback = {
          type: 'error',
          title: 'Could not check',
          message: 'The words could not be checked. Please try again.',
        };
        return;
      }
      if (invalid.length > 0) {
        this.feedback = {
          type: 'error',
          title: 'Not a word',
          message: `${invalid.join(', ')} ${invalid.length === 1 ? 'is' : 'are'} not in your word list, so this play is not allowed.`,
        };
        return;
      }

      const matchingSolution = findSolution(this.selectedScenario, play.words);
      if (matchingSolution) {
        const exact = sameTiles(this.currentBoard, matchingSolution);
        this.feedback = {
          type: 'success',
          title: 'Correct',
          message: exact
            ? matchingSolution.explanation
            : `You found ${matchingSolution.word}. ${matchingSolution.explanation}`,
          score: play.score,
        };
        return;
      }

      // A valid play of your own: compare it with the best listed play
      const bestSolutionScore = Math.max(...this.selectedScenario.solutions.map((s) => s.score));
      if (play.score >= bestSolutionScore * 0.9) {
        const longest = [...play.words].sort((a, b) => b.word.length - a.word.length)[0].word;
        this.feedback = {
          type: 'success',
          title: 'Good play',
          message: `${longest} is valid. Scored ${play.score} points.`,
          score: play.score,
        };
      } else {
        this.feedback = {
          type: 'info',
          title: 'Not the optimal solution',
          message: `Score: ${play.score} points — a better move worth ${bestSolutionScore} points.`,
          score: play.score,
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
      solution.tiles.forEach((tile) => {
        const { letter, row, col } = tile;

        // Find this letter in rack
        const rackIndex = this.rack.findIndex(
          (l, i) => l === letter && !this.usedTiles.includes(i)
        );

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
        score: solution.score,
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
    },
  },
};
</script>

<style scoped>
/* why: Afterglow page is flat surface-0; depth lives on cards via 1px edge + glint, never gradients */
#practice-mode {
  min-height: 100vh;
  background: var(--surface-0);
  color: var(--ink);
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
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink);
  padding: 10px 20px;
  font-size: 1rem;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
  border-radius: 6px;
}

/* why: hover lifts 1px with an accent edge; press is a 60ms scale(0.97); no blur outside modals */
.back-button:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.back-button:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.header h1 {
  font-size: 3.5rem;
  margin: 0 0 10px 0;
  color: var(--ink);
}

.subtitle {
  font-size: 1.3rem;
  color: var(--ink-muted);
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

/* why: matte surface-1 card + 1px edge + glint; glass blur is reserved for modals, never cards */
.category-card {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 12px;
  padding: 30px;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
  text-align: center;
}

.category-card:hover {
  transform: translateY(-1px);
  border-color: var(--accent-edge);
}

.category-card:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

/* why: category initial in a neutral surface-2 badge; hue is reserved, ink names the card */
.category-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: 20px;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink-muted);
  font-size: 2rem;
  font-weight: 700;
}

.category-card h2 {
  font-size: 1.5rem;
  margin: 0 0 15px 0;
  color: var(--ink);
}

.category-card p {
  color: var(--ink-muted);
  line-height: 1.6;
  margin: 0 0 20px 0;
  min-height: 50px;
}

.scenario-count {
  color: var(--ink-muted);
  font-weight: 600;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
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

/* why: sidebar is a docked panel, not a floating modal — flat surface-1, no blur, no cast shadow */
.sidebar {
  width: 420px;
  background: var(--surface-1);
  border-left: 1px solid var(--surface-edge);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  border-bottom: 1px solid var(--surface-edge);
  background: var(--surface-1);
}

.icon-button {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink);
  padding: 10px 15px;
  font-size: 1.2rem;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
  border-radius: 6px;
}

.icon-button:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.icon-button:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.scenario-info {
  flex: 1;
}

.scenario-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--ink);
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

/* why: difficulty reads as status — easy/success, medium/warn, hard/danger; no hand-picked hex */
.difficulty-badge.easy {
  background: var(--success-soft);
  color: var(--success);
  border: 1px solid var(--success-edge);
}

.difficulty-badge.medium {
  background: var(--warn-soft);
  color: var(--warn);
  border: 1px solid var(--warn-edge);
}

.difficulty-badge.hard {
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid var(--danger-edge);
}

.description-section {
  padding: 20px;
  border-bottom: 1px solid var(--surface-edge);
}

.description-section p {
  color: var(--ink-muted);
  line-height: 1.6;
  margin: 0 0 15px 0;
}

/* why: category tag is navigation context — accent edge, ink text keeps AA in both themes */
.category-badge {
  display: inline-block;
  background: var(--accent-soft);
  border: 1px solid var(--accent-edge);
  color: var(--ink);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.rack-section {
  padding: 20px;
  border-bottom: 1px solid var(--surface-edge);
}

.rack-section h3 {
  margin: 0 0 15px 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.rack {
  display: flex;
  gap: 8px;
  justify-content: center;
}

/* why: rack tiles are porcelain in both themes (anti-Scrabble rule) — never khaki/brown */
.tile {
  width: 45px;
  height: 45px;
  background: linear-gradient(180deg, var(--tile-face-hi), var(--tile-face-lo));
  border: 2px solid var(--tile-edge);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: grab;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    opacity var(--dur-quick) var(--ease-out);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  position: relative;
}

.tile:active {
  cursor: grabbing;
  transform: scale(0.97);
  transition-duration: 60ms;
}

.tile.used {
  opacity: 0.45;
  cursor: not-allowed;
}

.tile .letter {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--tile-ink);
  line-height: 1;
}

.tile .value {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--tile-sub);
  font-variant-numeric: tabular-nums;
}

.feedback-section {
  padding: 20px;
  border-bottom: 1px solid var(--surface-edge);
}

/* why: validation wins — success/danger only for right/wrong; info is neutral so it spends accent */
.feedback-box {
  display: flex;
  gap: 15px;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  animation: slideIn var(--dur-settle) var(--ease-out) both;
}

/* why: single-run arrival on opacity/transform only; reduced motion resolves to end state */
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
  background: var(--success-soft);
  border-color: var(--success-edge);
}

.feedback-box.error {
  background: var(--danger-soft);
  border-color: var(--danger-edge);
}

.feedback-box.info {
  background: var(--accent-soft);
  border-color: var(--accent-edge);
}

.feedback-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid currentColor;
  font-size: 1rem;
  font-weight: 700;
}

.feedback-box.success .feedback-icon {
  color: var(--success);
}

.feedback-box.error .feedback-icon {
  color: var(--danger);
}

.feedback-box.info .feedback-icon {
  color: var(--accent);
}

.feedback-content {
  flex: 1;
}

.feedback-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 5px;
  color: var(--ink);
}

.feedback-message {
  color: var(--ink-muted);
  line-height: 1.5;
  margin-bottom: 8px;
}

.feedback-score {
  color: var(--ink);
  font-weight: 700;
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}

.hints-section,
.solution-section {
  padding: 20px;
  border-bottom: 1px solid var(--surface-edge);
}

.hints-section h3,
.solution-section h3 {
  margin: 0 0 15px 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.hints-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* why: hints are cautionary help — warn family fill, ink text keeps contrast in both themes */
.hint-item {
  background: var(--warn-soft);
  border: 1px solid var(--warn-edge);
  color: var(--ink);
  padding: 12px;
  border-radius: 6px;
  line-height: 1.5;
}

.hint-button {
  background: var(--surface-2);
  border: 1px solid var(--warn-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink);
  padding: 10px 15px;
  cursor: pointer;
  border-radius: 6px;
  font-weight: 600;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.hint-button:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.hint-button:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

/* why: solutions are reference info, not validation — accent edge on a raised surface, ink text */
.solution-item {
  background: var(--surface-2);
  border: 1px solid var(--accent-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 10px;
}

.solution-word {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.solution-score {
  color: var(--ink-muted);
  font-weight: 700;
  margin-bottom: 10px;
  font-variant-numeric: tabular-nums;
}

.solution-explanation {
  color: var(--ink-muted);
  line-height: 1.5;
  margin-bottom: 15px;
}

.show-solution-button {
  background: var(--accent-soft);
  border: 1px solid var(--accent-edge);
  color: var(--ink);
  padding: 8px 15px;
  cursor: pointer;
  border-radius: 6px;
  font-weight: 600;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.show-solution-button:hover {
  transform: translateY(-1px);
}

.show-solution-button:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.actions-section {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* why: check uses --primary; next-step uses accent (interaction) — green is validation-only, never navigation */
.action-button {
  padding: 12px 20px;
  border: 1px solid var(--surface-edge);
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out),
    opacity var(--dur-quick) var(--ease-out);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.action-button:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.action-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.action-button.primary {
  background: var(--primary);
  border-color: transparent;
  color: var(--on-primary);
}

.action-button.primary:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.action-button.primary:active {
  background: var(--primary-pressed);
  transform: scale(0.97);
  transition-duration: 60ms;
}

.action-button.secondary {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink);
}

.action-button.secondary:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.action-button.success {
  background: var(--accent-soft);
  border: 1px solid var(--accent-edge);
  color: var(--ink);
}

.action-button.success:hover {
  transform: translateY(-1px);
}

@media (max-width: 900px) {
  .practice-layout {
    flex-direction: column;
    height: auto;
  }

  .sidebar {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--surface-edge);
  }
}

/* why: mirrors the global contract locally — nothing moves under reduced motion */
@media (prefers-reduced-motion: reduce) {
  #practice-mode *,
  #practice-mode *::before,
  #practice-mode *::after {
    animation: none;
    transition: none;
  }
}
</style>
