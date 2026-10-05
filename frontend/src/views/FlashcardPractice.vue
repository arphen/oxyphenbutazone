<template>
  <div class="flashcard-practice">
    <!-- Category Selection View -->
    <div v-if="!currentCategory" class="category-selection">
      <h1 class="title">Word Practice</h1>
      <p class="subtitle">Choose a category to practice with flashcards</p>

      <div class="categories-grid">
        <div
          v-for="category in allCategories"
          :key="category.id"
          class="category-card"
          @click="selectCategory(category.id)"
        >
          <div class="category-icon">{{ category.icon }}</div>
          <h3 class="category-name">{{ category.name }}</h3>
          <p class="category-description">{{ category.description }}</p>
          <div class="category-meta">
            <span class="difficulty-badge" :class="category.difficulty">
              {{ category.difficulty }}
            </span>
            <span v-if="getCategoryProgress(category.id)" class="progress-info">
              {{ getCategoryProgress(category.id) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Practice View -->
    <div v-else class="practice-view">
      <!-- Header with stats -->
      <div class="practice-header">
        <button class="back-btn" @click="exitCategory">← Back</button>
        <h2 class="category-title">{{ categoryInfo.icon }} {{ categoryInfo.name }}</h2>
      </div>

      <!-- Bucket Statistics (Karteikarten System) -->
      <div class="bucket-stats">
        <div class="stat-card new" :class="{ active: stats.new > 0 }">
          <div class="stat-icon">+</div>
          <div class="stat-label">New</div>
          <div class="stat-value">{{ stats.new }}</div>
        </div>
        <div class="stat-card learning" :class="{ active: stats.learning > 0 }">
          <div class="stat-icon">=</div>
          <div class="stat-label">Learning</div>
          <div class="stat-value">{{ stats.learning }}</div>
        </div>
        <div class="stat-card reviewing" :class="{ active: stats.reviewing > 0 }">
          <div class="stat-icon">~</div>
          <div class="stat-label">Reviewing</div>
          <div class="stat-value">{{ stats.reviewing }}</div>
        </div>
        <div class="stat-card mastered" :class="{ active: stats.mastered > 0 }">
          <div class="stat-icon">★</div>
          <div class="stat-label">Mastered</div>
          <div class="stat-value">{{ stats.mastered }}</div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
        <span class="progress-text">{{ stats.mastered }} / {{ stats.total }} mastered</span>
      </div>

      <!-- Current Flashcard -->
      <div v-if="!isPracticing" class="start-practice">
        <p
          v-if="!isLoading && stats.total === 0"
          class="empty-category"
          data-testid="empty-category"
        >
          No words in this category were found in the installed word list, so there is nothing to
          practise yet. Choose another list under <a href="#/words">Word lists</a>.
        </p>
        <button
          class="start-btn"
          @click="startPracticeSession"
          :disabled="isLoading || stats.total === 0"
        >
          {{ isLoading ? 'Loading...' : 'Start Practice' }}
        </button>
        <button class="reset-btn" @click="resetProgress">Reset Progress</button>
      </div>

      <div v-else-if="currentFlashcard" class="flashcard-container">
        <!-- Scenario Display -->
        <div class="scenario-info">
          <h3 class="target-word">{{ showAnswer ? currentFlashcard.word : 'Form a word!' }}</h3>
          <p class="scenario-hint">{{ currentScenario?.hint || 'Drag tiles to the board' }}</p>
          <div class="scenario-meta">
            <span class="scenario-type">{{ currentScenario?.description }}</span>
            <span class="scenario-difficulty">{{ currentScenario?.difficulty }}</span>
          </div>
        </div>

        <!-- Interactive Practice Rack -->
        <div class="practice-rack">
          <div class="rack-label">Your Tiles:</div>
          <div class="rack-tiles">
            <div
              v-for="(tile, index) in practiceRack"
              :key="index"
              class="practice-tile"
              :class="{ empty: !tile, blank: tile === '' }"
              :draggable="!!tile"
              @dragstart="onTileDragStart($event, tile, index)"
              @dragend="onTileDragEnd"
            >
              <span v-if="tile" class="tile-letter">{{ tile === '' ? '★' : tile }}</span>
              <span v-if="tile && tile !== ''" class="tile-value">{{ getLetterValue(tile) }}</span>
            </div>
          </div>
        </div>

        <!-- Interactive Mini Board (7x7 visible area) -->
        <div class="board-container">
          <!-- Pan Controls -->
          <div class="pan-controls">
            <button class="pan-btn pan-up" @click="panBoard('up')" title="Pan up">▲</button>
            <div class="pan-horizontal">
              <button class="pan-btn pan-left" @click="panBoard('left')" title="Pan left">◀</button>
              <button
                class="pan-btn pan-center"
                @click="panBoard('center')"
                title="Center on solution"
              >
                ⊙
              </button>
              <button class="pan-btn pan-right" @click="panBoard('right')" title="Pan right">
                ▶
              </button>
            </div>
            <button class="pan-btn pan-down" @click="panBoard('down')" title="Pan down">▼</button>
          </div>

          <div class="mini-board">
            <div v-for="(row, rowIndex) in visibleBoard" :key="rowIndex" class="board-row">
              <div
                v-for="(cell, colIndex) in row"
                :key="colIndex"
                class="board-cell"
                :class="getCellClass(cell)"
                @dragover.prevent="onCellDragOver($event, rowIndex, colIndex)"
                @dragenter.prevent="onCellDragEnter($event, rowIndex, colIndex)"
                @dragleave.prevent="onCellDragLeave($event)"
                @drop.prevent="onCellDrop($event, rowIndex, colIndex)"
                @click="onCellClick(rowIndex, colIndex)"
              >
                <span
                  v-if="cell.letter"
                  class="cell-letter"
                  :draggable="cell.isNew"
                  @dragstart="onBoardTileDragStart($event, cell, rowIndex, colIndex)"
                >
                  {{ cell.letter }}
                </span>
                <span v-else-if="cell.type" class="cell-label">{{
                  getPremiumLabel(cell.type)
                }}</span>
                <span v-if="cell.letter && !cell.locked" class="tile-value">{{
                  getLetterValue(cell.letter)
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flashcard-actions">
          <div class="game-controls">
            <button
              class="control-btn recall-btn"
              @click="recallAllTiles"
              :disabled="!hasPlacedTiles"
            >
              Recall Tiles
            </button>
            <button class="control-btn hint-btn" @click="showAnswer = !showAnswer">
              {{ showAnswer ? 'Hide' : 'Show hint' }}
            </button>
          </div>

          <div class="answer-buttons">
            <button class="submit-btn" @click="checkAnswer" :disabled="!hasPlacedTiles">
              ✓ Check Answer
            </button>
          </div>

          <div v-if="answerFeedback" class="feedback-message" :class="answerFeedback.type">
            {{ answerFeedback.message }}
          </div>

          <div v-if="answerChecked" class="next-controls">
            <button class="next-btn" @click="nextWord">Next Word →</button>
          </div>
        </div>

        <!-- Card Info -->
        <div class="card-info">
          <div class="bucket-badge" :class="currentFlashcard.bucket">
            {{ currentFlashcard.bucket }}
          </div>
          <div class="stats-row">
            <span>Correct {{ currentFlashcard.timesCorrect }}</span>
            <span>Missed {{ currentFlashcard.timesIncorrect }}</span>
            <span>Streak {{ currentFlashcard.consecutiveCorrect }}</span>
          </div>
        </div>
      </div>

      <div v-else class="completion-message">
        <h2>Complete</h2>
        <p>All words in this category are reviewed.</p>
        <button class="start-btn" @click="startPracticeSession">Practice Again</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFlashcards } from '../composables/useFlashcards.js';
import { generatePracticeScenario } from '../data/scenarioGenerator.js';
import { debug } from '../utils/log';

export default {
  name: 'FlashcardPractice',
  setup() {
    const router = useRouter();
    const {
      currentCategory,
      currentFlashcard,
      isLoading,
      stats,
      initializeCategory,
      startPractice,
      recordAnswer: recordFlashcardAnswer,
      getCategoryInfo,
      getAllCategories,
      resetCategory,
      flashcardsByCategory,
    } = useFlashcards();

    const isPracticing = ref(false);
    const showAnswer = ref(false);
    const currentScenario = ref(null);
    const allCategories = ref([]);

    // Interactive practice state
    const practiceRack = ref([]);
    const draggedTile = ref(null);
    const draggedFromRackIndex = ref(null);
    const draggedFromBoard = ref(null);
    const dragOverCell = ref(null);
    const answerFeedback = ref(null);
    const answerChecked = ref(false);

    // Board panning state
    const boardViewOffset = ref({ row: 0, col: 0 });

    onMounted(() => {
      allCategories.value = getAllCategories();
    });

    const categoryInfo = computed(() => {
      return currentCategory.value ? getCategoryInfo(currentCategory.value) : null;
    });

    const progressPercentage = computed(() => {
      if (stats.value.total === 0) return 0;
      return Math.round((stats.value.mastered / stats.value.total) * 100);
    });

    const hasPlacedTiles = computed(() => {
      if (!currentScenario.value) return false;
      return currentScenario.value.board.some((row) => row.some((cell) => cell.isNew));
    });

    // Get 7x7 visible board area centered on the solution (with offset)
    const visibleBoard = computed(() => {
      if (!currentScenario.value) return [];

      const fullBoard = currentScenario.value.board;
      const solution = currentScenario.value.solution;

      // Center view on the solution position (with user offset)
      const centerRow = (solution?.row || 7) + boardViewOffset.value.row;
      const centerCol = (solution?.col || 7) + boardViewOffset.value.col;

      const visible = [];
      for (let i = 0; i < 7; i++) {
        const row = [];
        for (let j = 0; j < 7; j++) {
          const boardRow = centerRow - 3 + i;
          const boardCol = centerCol - 3 + j;

          if (boardRow >= 0 && boardRow < 15 && boardCol >= 0 && boardCol < 15) {
            const cell = fullBoard[boardRow][boardCol];
            row.push({
              ...cell,
              actualRow: boardRow,
              actualCol: boardCol,
              type: getPremiumSquareType(boardRow, boardCol),
            });
          } else {
            row.push({ type: 'out-of-bounds' });
          }
        }
        visible.push(row);
      }

      return visible;
    });

    function getPremiumSquareType(row, col) {
      // Premium square positions (simplified)
      if (row === 7 && col === 7) return 'center';
      if ((row === 0 || row === 14) && (col === 0 || col === 14)) return 'tw';
      if ((row === 0 || row === 14) && col === 7) return 'tw';
      if (row === 7 && (col === 0 || col === 14)) return 'tw';
      if (row === col && [1, 2, 3, 4].includes(row)) return 'dw';
      if (row + col === 14 && [1, 2, 3, 4].includes(row)) return 'dw';
      // Add more premium squares as needed
      return null;
    }

    function getPremiumLabel(type) {
      const labels = {
        tw: 'TW',
        dw: 'DW',
        tl: 'TL',
        dl: 'DL',
        center: '★',
      };
      return labels[type] || '';
    }

    function getCellClass(cell) {
      const classes = [];
      if (cell.letter) classes.push('has-letter');
      if (cell.locked) classes.push('locked');
      if (cell.isNew) classes.push('new-tile');
      if (cell.type) classes.push(cell.type);
      if (
        dragOverCell.value &&
        dragOverCell.value.row === cell.actualRow &&
        dragOverCell.value.col === cell.actualCol
      ) {
        classes.push('drag-over');
      }
      return classes;
    }

    function getLetterValue(letter) {
      if (!letter || letter === '') return 0;
      const values = {
        a: 1,
        e: 1,
        i: 1,
        o: 1,
        u: 1,
        l: 1,
        n: 1,
        s: 1,
        t: 1,
        r: 1,
        d: 2,
        g: 2,
        b: 3,
        c: 3,
        m: 3,
        p: 3,
        f: 4,
        h: 4,
        v: 4,
        w: 4,
        y: 4,
        k: 5,
        j: 8,
        x: 8,
        q: 10,
        z: 10,
      };
      return values[letter.toLowerCase()] || 0;
    }

    async function selectCategory(categoryId) {
      await initializeCategory(categoryId);
    }

    function exitCategory() {
      currentCategory.value = null;
      isPracticing.value = false;
      showAnswer.value = false;
      answerFeedback.value = null;
      answerChecked.value = false;
      boardViewOffset.value = { row: 0, col: 0 };
    }

    function panBoard(direction) {
      const STEP = 2; // Move 2 cells at a time
      switch (direction) {
        case 'up':
          boardViewOffset.value.row = Math.max(boardViewOffset.value.row - STEP, -7);
          break;
        case 'down':
          boardViewOffset.value.row = Math.min(boardViewOffset.value.row + STEP, 7);
          break;
        case 'left':
          boardViewOffset.value.col = Math.max(boardViewOffset.value.col - STEP, -7);
          break;
        case 'right':
          boardViewOffset.value.col = Math.min(boardViewOffset.value.col + STEP, 7);
          break;
        case 'center':
          boardViewOffset.value = { row: 0, col: 0 };
          break;
      }
    }

    function startPracticeSession() {
      const card = startPractice();
      if (card) {
        isPracticing.value = true;
        showAnswer.value = false;
        answerFeedback.value = null;
        answerChecked.value = false;

        // Get all words in this category to avoid with decoy tiles
        const categoryWords =
          flashcardsByCategory.value[currentCategory.value]
            ?.map((fc) => fc.word.toUpperCase())
            .filter((w) => w !== card.word.toUpperCase()) || [];

        // Generate random scenario type
        const scenarioTypes = ['first-word', 'hook', 'extension'];
        const randomType = scenarioTypes[Math.floor(Math.random() * scenarioTypes.length)];
        currentScenario.value = generatePracticeScenario(card.word, randomType, categoryWords);

        // Initialize practice rack with the letters needed
        practiceRack.value = [...currentScenario.value.rack];

        // Reset board view to center
        boardViewOffset.value = { row: 0, col: 0 };
      }
    }

    // Drag and Drop Handlers
    function onTileDragStart(event, tile, index) {
      draggedTile.value = tile;
      draggedFromRackIndex.value = index;
      draggedFromBoard.value = null;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({ tile, fromRack: true, index }));
    }

    function onBoardTileDragStart(event, cell, row, col) {
      if (!cell.isNew) return; // Can't drag locked tiles
      draggedTile.value = cell.letter;
      draggedFromBoard.value = { row, col };
      draggedFromRackIndex.value = null;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(
        'text/plain',
        JSON.stringify({
          tile: cell.letter,
          fromBoard: true,
          row,
          col,
        })
      );
    }

    function onTileDragEnd() {
      draggedTile.value = null;
      draggedFromRackIndex.value = null;
      draggedFromBoard.value = null;
      dragOverCell.value = null;
    }

    function onCellDragOver(event, rowIndex, colIndex) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }

    function onCellDragEnter(event, rowIndex, colIndex) {
      event.preventDefault();
      const cell = visibleBoard.value[rowIndex][colIndex];
      // Only highlight empty cells
      if (!cell.letter && cell.type !== 'out-of-bounds') {
        dragOverCell.value = { row: cell.actualRow, col: cell.actualCol };
      }
    }

    function onCellDragLeave(event) {
      event.preventDefault();
      dragOverCell.value = null;
    }

    function onCellDrop(event, rowIndex, colIndex) {
      event.preventDefault();
      dragOverCell.value = null;

      const cell = visibleBoard.value[rowIndex][colIndex];

      // Can't drop on occupied cells or out of bounds
      if (cell.letter || cell.type === 'out-of-bounds') return;

      try {
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));

        if (data.fromRack) {
          // Place tile from rack to board
          const actualRow = cell.actualRow;
          const actualCol = cell.actualCol;
          currentScenario.value.board[actualRow][actualCol] = {
            letter: data.tile.toUpperCase(),
            isNew: true,
            locked: false,
            isBlank: data.tile === '',
            type: currentScenario.value.board[actualRow][actualCol].type,
          };

          // Remove from rack
          practiceRack.value[data.index] = null;
        } else if (data.fromBoard) {
          // Move tile on board
          const fromRow = data.row;
          const fromCol = data.col;
          const toRow = cell.actualRow;
          const toCol = cell.actualCol;

          // Move the tile
          currentScenario.value.board[toRow][toCol] = {
            ...currentScenario.value.board[fromRow][fromCol],
          };

          // Clear original position
          currentScenario.value.board[fromRow][fromCol] = {
            letter: '',
            isNew: false,
            locked: false,
            isBlank: false,
            type: currentScenario.value.board[fromRow][fromCol].type,
          };
        }
      } catch (error) {
        console.error('Error handling drop:', error);
      }
    }

    function onCellClick(rowIndex, colIndex) {
      const cell = visibleBoard.value[rowIndex][colIndex];

      // Click to recall a placed tile back to rack
      if (cell.letter && cell.isNew) {
        const actualRow = cell.actualRow;
        const actualCol = cell.actualCol;
        const letter = cell.letter;

        // Find empty slot in rack
        const emptyIndex = practiceRack.value.findIndex((t) => !t);
        if (emptyIndex !== -1) {
          practiceRack.value[emptyIndex] = letter;

          // Clear from board
          currentScenario.value.board[actualRow][actualCol] = {
            letter: '',
            isNew: false,
            locked: false,
            isBlank: false,
            type: currentScenario.value.board[actualRow][actualCol].type,
          };
        }
      }
    }

    function recallAllTiles() {
      // Return all new tiles to rack
      for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
          const cell = currentScenario.value.board[row][col];
          if (cell.isNew) {
            const emptyIndex = practiceRack.value.findIndex((t) => !t);
            if (emptyIndex !== -1) {
              practiceRack.value[emptyIndex] = cell.letter;
            }
            currentScenario.value.board[row][col] = {
              letter: '',
              isNew: false,
              locked: false,
              isBlank: false,
              type: cell.type,
            };
          }
        }
      }
      answerFeedback.value = null;
      answerChecked.value = false;
    }

    // Get all words formed on the board (horizontal and vertical)
    function getAllWordsFromBoard() {
      const words = [];
      const board = currentScenario.value.board;

      // Check horizontal words
      for (let row = 0; row < 15; row++) {
        let word = '';
        let tiles = [];
        for (let col = 0; col < 15; col++) {
          const cell = board[row][col];
          if (cell.letter) {
            word += cell.letter;
            tiles.push({ row, col, letter: cell.letter, isNew: cell.isNew });
          } else {
            if (word.length > 1) {
              words.push({ word, tiles: [...tiles], direction: 'horizontal' });
            }
            word = '';
            tiles = [];
          }
        }
        if (word.length > 1) {
          words.push({ word, tiles, direction: 'horizontal' });
        }
      }

      // Check vertical words
      for (let col = 0; col < 15; col++) {
        let word = '';
        let tiles = [];
        for (let row = 0; row < 15; row++) {
          const cell = board[row][col];
          if (cell.letter) {
            word += cell.letter;
            tiles.push({ row, col, letter: cell.letter, isNew: cell.isNew });
          } else {
            if (word.length > 1) {
              words.push({ word, tiles: [...tiles], direction: 'vertical' });
            }
            word = '';
            tiles = [];
          }
        }
        if (word.length > 1) {
          words.push({ word, tiles, direction: 'vertical' });
        }
      }

      return words;
    }

    async function checkAnswer() {
      // Get all words formed on the board
      const allWords = getAllWordsFromBoard();

      // Filter to only new words (words that contain at least one newly placed tile)
      // IMPORTANT: This filters out the anchor words placed by the scenario
      const newWords = allWords.filter((wordObj) => wordObj.tiles.some((tile) => tile.isNew));

      if (newWords.length === 0) {
        answerFeedback.value = {
          type: 'error',
          message: 'Place some tiles on the board first!',
        };
        return;
      }

      const targetWord = currentFlashcard.value.word;

      debug(
        '[Flashcard] New words to validate:',
        newWords.map((w) => w.word)
      );

      // Validate ALL formed words against the dictionary
      try {
        const validationResults = await Promise.all(
          newWords.map(async (wordObj) => {
            const response = await fetch('/api/action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'validate-word',
                word: wordObj.word,
              }),
            });

            if (!response.ok) {
              throw new Error('Failed to validate word');
            }

            const result = await response.json();
            debug('[Flashcard] Validation:', wordObj.word, '=', result.valid);
            return {
              word: wordObj.word,
              valid: result.valid,
              direction: wordObj.direction,
            };
          })
        );

        // Check if any words are invalid
        const invalidWords = validationResults.filter((r) => !r.valid);

        if (invalidWords.length > 0) {
          answerFeedback.value = {
            type: 'error',
            message: `Invalid word(s): ${invalidWords.map((w) => w.word).join(', ')}. All formed words must be valid!`,
          };
          answerChecked.value = true;
          return;
        }

        // Find the main word (the one containing the target)
        const mainWord = newWords.find(
          (wordObj) => wordObj.word.toUpperCase() === targetWord.toUpperCase()
        );

        answerChecked.value = true;

        if (mainWord) {
          answerFeedback.value = {
            type: 'success',
            message: `Correct: "${targetWord}".${newWords.length > 1 ? ` (${newWords.length - 1} crossword${newWords.length > 2 ? 's' : ''} formed)` : ''}`,
          };
          // Auto-record as correct
          recordFlashcardAnswer(true);
        } else {
          const playedWords = newWords.map((w) => w.word).join(', ');
          answerFeedback.value = {
            type: 'error',
            message: `You played "${playedWords}" but the target was "${targetWord}". Try again!`,
          };
        }
      } catch (error) {
        console.error('Error validating words:', error);
        answerFeedback.value = {
          type: 'error',
          message: 'Error checking words. Please try again.',
        };
      }
    }

    function nextWord() {
      // Move to next word
      const nextCard = startPractice();
      if (nextCard) {
        showAnswer.value = false;
        answerFeedback.value = null;
        answerChecked.value = false;

        // Get all words in this category to avoid with decoy tiles
        const categoryWords =
          flashcardsByCategory.value[currentCategory.value]
            ?.map((fc) => fc.word.toUpperCase())
            .filter((w) => w !== nextCard.word.toUpperCase()) || [];

        const scenarioTypes = ['first-word', 'hook', 'extension'];
        const randomType = scenarioTypes[Math.floor(Math.random() * scenarioTypes.length)];
        currentScenario.value = generatePracticeScenario(nextCard.word, randomType, categoryWords);
        practiceRack.value = [...currentScenario.value.rack];

        // Reset board view to center
        boardViewOffset.value = { row: 0, col: 0 };
      } else {
        isPracticing.value = false;
      }
    }

    function resetProgress() {
      if (confirm('Reset all progress for this category?')) {
        resetCategory(currentCategory.value);
      }
    }

    function getCategoryProgress(categoryId) {
      const cards = flashcardsByCategory.value[categoryId];
      if (!cards) return null;

      const mastered = cards.filter((c) => c.bucket === 'mastered').length;
      return `${mastered}/${cards.length}`;
    }

    return {
      // State
      currentCategory,
      currentFlashcard,
      isLoading,
      isPracticing,
      showAnswer,
      currentScenario,
      allCategories,
      categoryInfo,
      stats,
      progressPercentage,
      visibleBoard,
      practiceRack,
      answerFeedback,
      answerChecked,
      hasPlacedTiles,

      // Methods
      selectCategory,
      exitCategory,
      startPracticeSession,
      resetProgress,
      getCategoryProgress,
      getPremiumLabel,
      getCellClass,
      getLetterValue,
      panBoard,
      onTileDragStart,
      onBoardTileDragStart,
      onTileDragEnd,
      onCellDragOver,
      onCellDragEnter,
      onCellDragLeave,
      onCellDrop,
      onCellClick,
      recallAllTiles,
      checkAnswer,
      nextWord,
    };
  },
};
</script>

<style scoped>
/* Afterglow: the page is flat surface-0; panels are matte surface-1/2 with a
   1px surface-edge and an inset top glint. Glass blur is reserved for large
   floating overlays, so no card or cell below uses backdrop-filter. */
.flashcard-practice {
  min-height: 100vh;
  background: var(--surface-0);
  color: var(--ink);
  padding: 20px;
}

/* Scores and counts never jitter. */
.stat-value,
.progress-text,
.progress-info,
.tile-value,
.stats-row {
  font-variant-numeric: tabular-nums;
}

.category-selection {
  max-width: 1200px;
  margin: 0 auto;
}

/* Headers stay ink: hue is reserved for word identities, not titles. */
.title {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 10px;
  color: var(--ink);
}

.subtitle {
  text-align: center;
  color: var(--ink-muted);
  margin-bottom: 40px;
  font-size: 1.1rem;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-top: 30px;
}

/* Matte card. Hover lifts 2px and shifts the edge to accent (interaction);
   press settles at scale(0.97) over 60ms. */
.category-card {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 16px;
  padding: 24px;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.category-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent-edge);
}

.category-card:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.category-icon {
  font-size: 3rem;
  text-align: center;
  margin-bottom: 16px;
  color: var(--ink);
}

.category-name {
  font-size: 1.3rem;
  margin-bottom: 8px;
  text-align: center;
  color: var(--ink);
}

.category-description {
  color: var(--ink-muted);
  text-align: center;
  font-size: 0.9rem;
  margin-bottom: 16px;
  min-height: 40px;
}

.category-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

/* Difficulty spends token families only: beginner reads success,
   intermediate reads warn (caution), advanced reads danger, expert — the
   highest interaction tier — reads accent. */
.difficulty-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid var(--surface-edge);
}

.difficulty-badge.beginner {
  background: var(--success-soft);
  border-color: var(--success-edge);
  color: var(--success);
}

.difficulty-badge.intermediate {
  background: var(--warn-soft);
  border-color: var(--warn-edge);
  color: var(--warn);
}

.difficulty-badge.advanced {
  background: var(--danger-soft);
  border-color: var(--danger-edge);
  color: var(--danger);
}

.difficulty-badge.expert {
  background: var(--accent-soft);
  border-color: var(--accent-edge);
  color: var(--accent);
}

.progress-info {
  font-size: 0.85rem;
  color: var(--ink-faint);
}

/* Practice View */
.practice-view {
  max-width: 800px;
  margin: 0 auto;
}

.practice-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
}

.back-btn {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink);
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.back-btn:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.back-btn:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.category-title {
  font-size: 1.8rem;
  flex: 1;
  color: var(--ink);
}

/* Bucket Statistics */
.bucket-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

/* Count cards stay neutral matte; a nonzero count is selection state, so the
   active edge spends accent — never validation green/red. */
.stat-card {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  transition:
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.stat-card.active {
  border-color: var(--accent-edge);
}

/* Plain-text markers inherit the bucket family so no hue is invented here. */
.stat-icon {
  font-size: 1.5rem;
  line-height: 1;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--ink-faint);
}

.stat-card.new .stat-icon {
  color: var(--accent);
}

.stat-card.learning .stat-icon {
  color: var(--warn);
}

.stat-card.reviewing .stat-icon {
  color: var(--ink-muted);
}

.stat-card.mastered .stat-icon {
  color: var(--success);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink);
}

/* Progress Bar */
.progress-bar {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  border-radius: 20px;
  height: 32px;
  position: relative;
  overflow: hidden;
  margin-bottom: 30px;
}

/* Progress is interaction, not a verdict, so the fill spends accent. Width
   applies instantly: the motion contract allows no width transition. */
.progress-fill {
  background: var(--accent);
  height: 100%;
  border-radius: 20px;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: 600;
  color: var(--accent-ink);
  white-space: nowrap;
}

/* Start Practice */
.start-practice {
  display: flex;
  flex-direction: column;
  gap: 15px;
  align-items: center;
  padding: 40px;
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 16px;
}

/* Empty state is caution (warn family): honest about having nothing to show. */
.empty-category {
  max-width: 420px;
  margin: 0;
  text-align: center;
  color: var(--warn);
  background: var(--warn-soft);
  border: 1px solid var(--warn-edge);
  border-radius: 12px;
  padding: 16px;
  line-height: 1.5;
}

.start-btn,
.reset-btn {
  padding: 16px 32px;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out),
    opacity var(--dur-quick) var(--ease-out);
}

/* Primary practice entry spends the primary ramp; destructive reset spends
   danger so the cost is visible before the confirm. */
.start-btn {
  background: var(--primary);
  border: 1px solid var(--primary);
  color: var(--on-primary);
}

.start-btn:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.start-btn:active:not(:disabled) {
  background: var(--primary-pressed);
  transform: scale(0.97);
  transition-duration: 60ms;
}

.start-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.reset-btn {
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid var(--danger-edge);
}

.reset-btn:hover {
  transform: translateY(-1px);
}

.reset-btn:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

/* Flashcard */
.flashcard-container {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 16px;
  padding: 24px;
}

.scenario-info {
  text-align: center;
  margin-bottom: 24px;
}

.target-word {
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: 12px;
  color: var(--ink);
}

.scenario-hint {
  font-size: 1.1rem;
  color: var(--ink-muted);
  margin-bottom: 12px;
}

.scenario-meta {
  display: flex;
  justify-content: center;
  gap: 15px;
  font-size: 0.9rem;
  color: var(--ink-faint);
}

/* Board Container with Pan Controls */
.board-container {
  display: flex;
  gap: 15px;
  align-items: center;
  justify-content: center;
  margin: 20px 0;
}

.pan-controls {
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: center;
}

.pan-horizontal {
  display: flex;
  gap: 5px;
}

.pan-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--surface-edge);
  background: var(--surface-2);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink);
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.pan-btn:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.pan-btn:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

/* Recenter marks the selected view, so it wears the accent edge. */
.pan-center {
  background: var(--accent-soft);
  border-color: var(--accent-edge);
  color: var(--accent);
}

/* Mini Board */
.mini-board {
  display: inline-block;
  background: var(--board-bezel);
  border: 1px solid var(--board-edge);
  padding: 10px;
  border-radius: 8px;
}

.board-row {
  display: flex;
  justify-content: center;
}

.board-cell {
  width: 50px;
  height: 50px;
  border: 1px solid var(--board-line);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  font-size: 1.2rem;
  font-weight: 700;
  background: var(--board-cell);
  color: var(--ink);
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.board-cell:hover {
  background: var(--board-cell-hover);
}

/* Committed tiles stay porcelain in both themes (dark ink on light face). */
.board-cell.has-letter {
  background: linear-gradient(180deg, var(--tile-face-hi), var(--tile-face-lo));
  border-color: var(--tile-edge);
  color: var(--tile-ink);
}

.board-cell.locked {
  background: linear-gradient(180deg, var(--tile-face-hi), var(--tile-face-lo));
  border-color: var(--tile-edge);
  color: var(--tile-ink);
}

/* Premium squares spend the jewel-tint tokens, never wood tones. */
.board-cell.tw {
  background: var(--premium-tw);
}
.board-cell.dw {
  background: var(--premium-dw);
}
.board-cell.tl {
  background: var(--premium-tl);
}
.board-cell.dl {
  background: var(--premium-dl);
}
.board-cell.center {
  background: var(--premium-center);
}

.cell-letter {
  font-size: 1.3rem;
  cursor: grab;
  user-select: none;
}

.cell-letter:active {
  cursor: grabbing;
}

.cell-label {
  font-size: 0.7rem;
  color: var(--ink-muted);
}

.board-cell.tw .cell-label {
  color: var(--premium-tw-ink);
}
.board-cell.dw .cell-label {
  color: var(--premium-dw-ink);
}
.board-cell.tl .cell-label {
  color: var(--premium-tl-ink);
}
.board-cell.dl .cell-label {
  color: var(--premium-dl-ink);
}
.board-cell.center .cell-label {
  color: var(--premium-center-ink);
}

/* Actions */
.flashcard-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
}

.answer-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* Card Info */
.card-info {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--surface-edge);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Bucket identity: new takes accent, learning takes warn, reviewing stays
   neutral ink, mastered takes success. Fill plus edge, no glow. */
.bucket-badge {
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid var(--surface-edge);
}

.bucket-badge.new {
  background: var(--accent-soft);
  border-color: var(--accent-edge);
  color: var(--accent);
}
.bucket-badge.learning {
  background: var(--warn-soft);
  border-color: var(--warn-edge);
  color: var(--warn);
}
.bucket-badge.reviewing {
  background: var(--surface-2);
  border-color: var(--surface-edge);
  color: var(--ink-muted);
}
.bucket-badge.mastered {
  background: var(--success-soft);
  border-color: var(--success-edge);
  color: var(--success);
}

.stats-row {
  display: flex;
  gap: 16px;
  font-size: 0.9rem;
  color: var(--ink-muted);
}

.completion-message {
  text-align: center;
  padding: 60px 20px;
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 16px;
}

.completion-message h2 {
  font-size: 2.5rem;
  margin-bottom: 16px;
  color: var(--ink);
}

.completion-message p {
  font-size: 1.2rem;
  color: var(--ink-muted);
  margin-bottom: 30px;
}

/* Interactive Practice Rack */
.practice-rack {
  margin: 20px 0;
  padding: 20px;
  background: var(--surface-2);
  border-radius: 12px;
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
}

.rack-label {
  text-align: center;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink-muted);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.rack-tiles {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Rack tiles are porcelain objects: light face, dark ink, steady edge. */
.practice-tile {
  width: 60px;
  height: 60px;
  background: linear-gradient(180deg, var(--tile-face-hi), var(--tile-face-lo));
  border: 1px solid var(--tile-edge);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: grab;
  box-shadow: var(--shadow-sm);
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.practice-tile:not(.empty):hover {
  transform: translateY(-2px);
  border-color: var(--accent-edge);
}

.practice-tile:active {
  cursor: grabbing;
  transform: scale(0.97);
  transition-duration: 60ms;
}

.practice-tile.empty {
  background: var(--surface-1);
  border: 1px dashed var(--surface-edge);
  box-shadow: none;
  cursor: default;
}

/* A blank tile is wild, so it carries the accent edge (interaction). */
.practice-tile.blank {
  border-color: var(--accent-edge);
}

.practice-tile .tile-letter {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--tile-ink);
}

.practice-tile .tile-value {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--tile-sub);
}

/* Board Interactive Styles: transitions stay on transform, border-color and
   background-color only. */
.board-cell.new-tile {
  background: var(--accent-soft);
  border-color: var(--accent-edge);
  color: var(--accent);
  /* A staged (not yet checked) tile is interaction, so it wears accent:
     green is reserved for checked-correct verdicts. One arrival, not a loop. */
  animation: pulse-green 1.5s ease-in-out 1;
}

@keyframes pulse-green {
  0%,
  100% {
    background: var(--accent-soft);
  }
  50% {
    background: var(--accent-edge);
  }
}

/* A drop target is interaction: accent fill and edge with a slight lift. */
.board-cell.drag-over {
  background: var(--accent-soft);
  border-color: var(--accent-edge);
  transform: scale(1.04);
  z-index: 10;
}

.board-cell .tile-value {
  position: absolute;
  bottom: 4px;
  right: 4px;
  font-size: 0.7rem;
  color: var(--tile-sub);
  font-weight: 600;
}

/* Game Controls */
.game-controls {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.control-btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out),
    opacity var(--dur-quick) var(--ease-out);
}

/* Recall unstages tiles: caution (warn). Hint offers help: accent. */
.recall-btn {
  background: var(--warn-soft);
  color: var(--warn);
  border: 1px solid var(--warn-edge);
}

.recall-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.recall-btn:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.recall-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.hint-btn {
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--accent-edge);
}

.hint-btn:hover {
  transform: translateY(-1px);
}

.hint-btn:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.submit-btn {
  width: 100%;
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  background: var(--primary);
  border: 1px solid var(--primary);
  color: var(--on-primary);
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out),
    opacity var(--dur-quick) var(--ease-out);
}

.submit-btn:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.submit-btn:active:not(:disabled) {
  background: var(--primary-pressed);
  transform: scale(0.97);
  transition-duration: 60ms;
}

.submit-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

/* Feedback Message: a verdict keeps to itself — family fill, family ink,
   family edge, no glow. The arrival plays once. */
.feedback-message {
  padding: 16px;
  border-radius: 10px;
  text-align: center;
  font-weight: 600;
  font-size: 1.05rem;
  border: 1px solid var(--surface-edge);
  animation: slideIn var(--dur-settle) var(--ease-out) 1;
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

.feedback-message.success {
  background: var(--success-soft);
  color: var(--success);
  border-color: var(--success-edge);
}

.feedback-message.error {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: var(--danger-edge);
}

.next-controls {
  display: flex;
  justify-content: center;
}

.next-btn {
  padding: 14px 32px;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  background: var(--primary);
  border: 1px solid var(--primary);
  color: var(--on-primary);
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.next-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.next-btn:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

@media (max-width: 768px) {
  .bucket-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .categories-grid {
    grid-template-columns: 1fr;
  }

  .board-cell {
    width: 40px;
    height: 40px;
    font-size: 1rem;
  }

  .practice-tile {
    width: 50px;
    height: 50px;
  }

  .practice-tile .tile-letter {
    font-size: 1.5rem;
  }
}
</style>
