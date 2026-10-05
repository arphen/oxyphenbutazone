<template>
  <div id="freeplay">
    <div class="freeplay-layout">
      <!-- Board Section -->
      <div class="board-section">
        <Board :board="board" @place-letter="handlePlaceLetter" @cell-click="handleCellClick" />
      </div>

      <!-- Sidebar -->
      <div class="sidebar">
        <!-- Header Controls -->
        <div class="sidebar-header">
          <button @click="goHome" class="icon-button" title="Back to Menu">Menu</button>
          <DictionaryChooser
            :selectedDictionaries="selectedDictionaries"
            :installed="installedLists"
            @update="handleDictionaryUpdate"
          />
          <button @click="clearBoard" class="icon-button" title="Clear Board">Clear</button>
        </div>

        <!-- Tile Picker -->
        <div class="tile-picker-section">
          <h3>Tile supply</h3>
          <div class="alphabet-grid">
            <div
              v-for="letter in alphabet"
              :key="letter"
              class="letter-tile"
              draggable="true"
              @dragstart="handleDragFromAlphabet($event, letter)"
              @dragend="handleDragEnd"
            >
              {{ letter }}
            </div>
            <div
              class="letter-tile blank-tile"
              draggable="true"
              @dragstart="handleDragFromAlphabet($event, '')"
              @dragend="handleDragEnd"
              title="Blank tile"
            >
              ?
            </div>
          </div>
        </div>

        <!-- Word Validation Results -->
        <div class="validation-section">
          <h3>Words on board</h3>
          <div v-if="listProblem" class="list-problem" data-testid="list-problem">
            {{ listProblem }}
            <a href="#/words">Word lists…</a>
          </div>
          <div v-if="boardWords.length === 0" class="no-words">No words on the board yet</div>
          <div v-else class="words-list">
            <div
              v-for="(wordObj, index) in boardWords"
              :key="index"
              class="word-item"
              :class="{
                valid: isWordValid(wordObj.word),
                invalid: !isWordValid(wordObj.word),
              }"
            >
              <span class="word-text">{{ wordObj.word }}</span>
              <span class="word-score">{{ calculateWordScore(wordObj) }} pts</span>
              <span class="word-status">
                {{ isWordValid(wordObj.word) ? '✓' : '✗' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Instructions -->
        <div class="instructions-section">
          <h3>How to play</h3>
          <ul>
            <li>Drag a letter from the supply to the board</li>
            <li>No turn order. Place tiles freely</li>
            <li>Words check against the chosen list as placed</li>
            <li>Explore prefixes and suffixes</li>
            <li>Move tiles around by dragging them</li>
            <li>Click on a tile to remove it from the board</li>
            <li>Use the trash button to clear everything</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { markRaw } from 'vue';
import Board from '../components/Board.vue';
import DictionaryChooser from '../components/DictionaryChooser.vue';
import { getBackend } from '../net/api';
import { buildWordSet, initialSelection, selectedIds } from '../utils/freePlayWords';
import { debug } from '../utils/log';

export default {
  name: 'FreePlay',
  components: {
    Board,
    DictionaryChooser,
  },
  data() {
    return {
      board: this.createInitialBoard(),
      alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
      dictionary: markRaw(new Set()), // upper-case words accepted by the lists picked in the chooser
      selectedDictionaries: { csw21: false, nwl2023: false, enable: false, slovenian: false },
      installedLists: null, // ids of the word lists this device has (standalone build); null = do not restrict the chooser
      listProblem: '', // shown when no list is available, so no word can be checked
      draggedLetter: null,
      dragSource: null, // 'alphabet' or 'board'
      dragSourcePosition: null, // {row, col} if from board
    };
  },
  computed: {
    boardWords() {
      return this.getWordsFromBoard();
    },
  },
  created() {
    this.listCache = new Map(); // id -> Set of words; not reactive on purpose (lists have 100k+ words)
  },
  async mounted() {
    await this.loadDictionary();
  },
  methods: {
    createInitialBoard() {
      const board = Array(15)
        .fill(null)
        .map(() =>
          Array(15)
            .fill(null)
            .map(() => ({
              letter: '',
              type: '',
              isNew: false,
            }))
        );

      const specialSquares = {
        tw: [
          [0, 0],
          [0, 7],
          [0, 14],
          [7, 0],
          [7, 14],
          [14, 0],
          [14, 7],
          [14, 14],
        ],
        dw: [
          [1, 1],
          [2, 2],
          [3, 3],
          [4, 4],
          [1, 13],
          [2, 12],
          [3, 11],
          [4, 10],
          [13, 1],
          [12, 2],
          [11, 3],
          [10, 4],
          [13, 13],
          [12, 12],
          [11, 11],
          [10, 10],
        ],
        tl: [
          [1, 5],
          [1, 9],
          [5, 1],
          [5, 5],
          [5, 9],
          [5, 13],
          [9, 1],
          [9, 5],
          [9, 9],
          [9, 13],
          [13, 5],
          [13, 9],
        ],
        dl: [
          [0, 3],
          [0, 11],
          [2, 6],
          [2, 8],
          [3, 0],
          [3, 7],
          [3, 14],
          [6, 2],
          [6, 6],
          [6, 8],
          [6, 12],
          [7, 3],
          [7, 11],
          [8, 2],
          [8, 6],
          [8, 8],
          [8, 12],
          [11, 0],
          [11, 7],
          [11, 14],
          [12, 6],
          [12, 8],
          [14, 3],
          [14, 11],
        ],
      };

      for (const type in specialSquares) {
        specialSquares[type].forEach(([r, c]) => {
          board[r][c].type = type;
        });
      }

      board[7][7].type = 'center';
      return board;
    },

    // The lists come from the game's own word endpoint, so Free Play works with whichever lists this device has
    // (ENABLE in the public build; CSW21/NWL2023 once the player has imported them).
    async loadDictionary() {
      try {
        const status = await getBackend()?.listStatus?.();
        if (status)
          this.installedLists = Object.keys(status).filter(
            (id) => status[id].shipped || status[id].imported
          );
      } catch {
        this.installedLists = null;
      }
      let gameDictionaries = null;
      try {
        const response = await fetch('/api/game-state');
        if (response.ok) gameDictionaries = (await response.json()).dictionaries || null;
      } catch {
        /* no game running: start from the best available list */
      }
      this.selectedDictionaries = initialSelection(gameDictionaries, this.installedLists);
      await this.updateActiveDictionary();
    },

    async updateActiveDictionary() {
      const ids = selectedIds(this.selectedDictionaries);
      const { words, loaded } = await buildWordSet(ids, this.listCache);
      // Ignore a result that a newer choice has already replaced
      if (ids.join() !== selectedIds(this.selectedDictionaries).join()) return;
      this.dictionary = markRaw(words);
      this.listProblem =
        loaded.length > 0
          ? ''
          : ids.length === 0
            ? 'No word list is installed on this device, so words cannot be checked.'
            : 'The chosen word list could not be loaded, so words cannot be checked.';
      debug(`Active dictionary: ${words.size} words (${loaded.join(', ') || 'none'})`);
    },

    handleDictionaryUpdate(selection) {
      if (selectedIds(selection).length === 0) {
        // Keep at least one list; a fresh object makes the chooser tick the box again
        this.selectedDictionaries = { ...this.selectedDictionaries };
        return;
      }
      this.selectedDictionaries = selection;
      this.updateActiveDictionary();
    },

    handleDragFromAlphabet(event, letter) {
      this.draggedLetter = letter;
      this.dragSource = 'alphabet';
      // The board's drop target says dropEffect 'move', which a plain 'copy' would forbid (the browser then never fires drop)
      event.dataTransfer.effectAllowed = 'copyMove';
      // Set the drag data in the format the Board component expects
      event.dataTransfer.setData(
        'text/plain',
        JSON.stringify({
          letter,
          from: 'alphabet',
          index: -1,
        })
      );
    },

    handleDragEnd(event) {
      this.draggedLetter = null;
      this.dragSource = null;
    },

    handlePlaceLetter(data) {
      const { letter, from, index, toRowIndex, toColIndex, fromRowIndex, fromColIndex } = data;

      if (from === 'board') {
        // Moving tile from one board position to another
        if (this.board[toRowIndex][toColIndex].letter) {
          // Target cell is occupied, swap the letters
          const tempLetter = this.board[toRowIndex][toColIndex].letter;
          this.board[toRowIndex][toColIndex].letter = letter;
          this.board[fromRowIndex][fromColIndex].letter = tempLetter;
        } else {
          // Target cell is empty, just move
          this.board[toRowIndex][toColIndex].letter = letter;
          this.board[fromRowIndex][fromColIndex].letter = '';
        }
      } else {
        // Placing new tile from alphabet (treat as unlimited supply)
        if (!this.board[toRowIndex][toColIndex].letter) {
          this.board[toRowIndex][toColIndex].letter = letter;
        }
      }

      // Mark all tiles as "new" for scoring preview purposes
      this.board[toRowIndex][toColIndex].isNew = true;

      // Force reactivity update
      this.board = [...this.board];
    },

    handleCellClick({ row, col }) {
      // Click on a tile to remove it
      if (this.board[row][col].letter) {
        this.board[row][col].letter = '';
        this.board[row][col].isNew = false;
        // Force reactivity update
        this.board = [...this.board];
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

    isWordValid(word) {
      return this.dictionary.has(word.toUpperCase());
    },

    getLetterValue(letter) {
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
        '': 0,
      };
      return values[letter.toLowerCase()] || 0;
    },

    calculateWordScore(wordObj) {
      let score = 0;
      let wordMultiplier = 1;

      wordObj.tiles.forEach((tile) => {
        const { row, col, isNew } = tile;
        const letter = this.board[row][col].letter;
        const squareType = this.board[row][col].type;
        let letterValue = this.getLetterValue(letter);

        // In freeplay, we can apply premium squares to all tiles
        if (squareType === 'dl') {
          letterValue *= 2;
        } else if (squareType === 'tl') {
          letterValue *= 3;
        } else if (squareType === 'dw' || squareType === 'center') {
          wordMultiplier *= 2;
        } else if (squareType === 'tw') {
          wordMultiplier *= 3;
        }

        score += letterValue;
      });

      score *= wordMultiplier;
      return score;
    },

    clearBoard() {
      if (confirm('Clear the entire board?')) {
        this.board = this.createInitialBoard();
      }
    },

    goHome() {
      this.$router.push('/');
    },
  },
};
</script>

<style scoped>
/* Why: page is a flat plane; depth lives on panels, never the backdrop. */
#freeplay {
  background: var(--surface-0, #0c1015);
  min-height: 100vh;
  color: var(--ink, #f2f2f6);
  padding: 0;
  margin: 0;
}

.freeplay-layout {
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

/* Why: sidebar is a matte card — 1px edge + inner glint, no blur (R10: blur
   is for large floating overlays only, never panels or rows). */
.sidebar {
  width: 400px;
  background: var(--surface-1, #161c24);
  border-left: 1px solid var(--surface-edge, #39434f);
  box-shadow: inset 0 1px 0 var(--surface-glint, #ffffff14);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  display: flex;
  gap: 10px;
  padding: 15px;
  border-bottom: 1px solid var(--surface-edge, #39434f);
  background: var(--surface-1, #161c24);
}

/* Why: quiet button — edge shift + 1px lift on hover, 60ms press. */
.icon-button {
  background: var(--surface-2, #1f2732);
  border: 1px solid var(--surface-edge, #39434f);
  box-shadow: inset 0 1px 0 var(--surface-glint, #ffffff14);
  color: var(--ink, #f2f2f6);
  padding: 10px 15px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  transition:
    transform 160ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    border-color 160ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color 160ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.icon-button:hover {
  border-color: var(--accent-edge, rgb(122 168 255 / 0.55));
  transform: translateY(-1px);
}

.icon-button:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.icon-button:focus-visible {
  outline: 2px solid var(--focus-ring, #8dc7ff);
  outline-offset: 3px;
}

.tile-picker-section {
  padding: 20px 15px;
  border-bottom: 1px solid var(--surface-edge, #39434f);
}

.tile-picker-section h3 {
  margin: 0 0 15px 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ink-muted, #b9c1cc);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.alphabet-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

/* Why: supply tiles are porcelain in both themes — light face, dark ink —
   never wood tones. Blank keeps the same face with faint ink. */
.letter-tile {
  aspect-ratio: 1;
  background: linear-gradient(var(--tile-face-hi, #ffffff), var(--tile-face-lo, #e9e6da));
  border: 1px solid var(--tile-edge, #2a323d);
  box-shadow: inset 0 1px 0 var(--surface-glint, #ffffff14);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--tile-ink, #1c2330);
  cursor: grab;
  user-select: none;
  transition:
    transform 160ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    border-color 160ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color 160ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.letter-tile:hover {
  transform: translateY(-1px);
  border-color: var(--accent-edge, rgb(122 168 255 / 0.55));
}

.letter-tile:active {
  cursor: grabbing;
  transform: scale(0.97);
  transition-duration: 60ms;
}

.letter-tile:focus-visible {
  outline: 2px solid var(--focus-ring, #8dc7ff);
  outline-offset: 3px;
}

.blank-tile {
  color: var(--tile-sub, #5b6472);
}

.validation-section {
  flex: 1;
  padding: 20px 15px;
  overflow-y: auto;
  border-bottom: 1px solid var(--surface-edge, #39434f);
}

.validation-section h3 {
  margin: 0 0 15px 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ink-muted, #b9c1cc);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Why: a missing list is caution, not failure — warn family only. */
.list-problem {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: var(--warn-soft, rgb(251 191 36 / 0.14));
  border: 1px solid var(--warn-edge, rgb(251 191 36 / 0.55));
  box-shadow: inset 0 1px 0 var(--surface-glint, #ffffff14);
  border-radius: 8px;
  color: var(--warn, #fbbf24);
  font-size: 0.9rem;
}

.list-problem a {
  color: var(--accent, #7aa8ff);
  margin-left: 6px;
}

.list-problem a:focus-visible {
  outline: 2px solid var(--focus-ring, #8dc7ff);
  outline-offset: 3px;
}

.no-words {
  text-align: center;
  color: var(--ink-faint, #8d97a3);
  padding: 30px 0;
}

.words-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Why: rows are matte surface-2 with a hairline edge; validation wins over
   any selection tint, so right/wrong read green/red only. */
.word-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 15px;
  background: var(--surface-2, #1f2732);
  border: 1px solid var(--surface-edge, #39434f);
  box-shadow: inset 0 1px 0 var(--surface-glint, #ffffff14);
  border-radius: 8px;
  transition:
    border-color 160ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color 160ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.word-item.valid {
  background: var(--success-soft, rgb(74 222 128 / 0.14));
  border-color: var(--success-edge, rgb(74 222 128 / 0.55));
}

.word-item.invalid {
  background: var(--danger-soft, rgb(248 113 113 / 0.14));
  border-color: var(--danger-edge, rgb(248 113 113 / 0.55));
}

.word-text {
  font-weight: 600;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  flex: 1;
  color: var(--ink, #f2f2f6);
}

/* Why: tabular numerals keep scores from jittering as words change. */
.word-score {
  color: var(--ink-muted, #b9c1cc);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  margin-right: 10px;
}

.word-status {
  font-size: 1.2rem;
  color: var(--ink-muted, #b9c1cc);
}

.word-item.valid .word-status {
  color: var(--success, #4ade80);
}

.word-item.invalid .word-status {
  color: var(--danger, #f87171);
}

.instructions-section {
  padding: 20px 15px;
  background: var(--surface-1, #161c24);
}

.instructions-section h3 {
  margin: 0 0 15px 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ink-muted, #b9c1cc);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.instructions-section ul {
  margin: 0;
  padding-left: 20px;
  color: var(--ink-muted, #b9c1cc);
}

.instructions-section li {
  margin-bottom: 8px;
  line-height: 1.5;
}

/* Why: reduced motion keeps the light, drops the movement. */
@media (prefers-reduced-motion: reduce) {
  #freeplay *,
  #freeplay *::before,
  #freeplay *::after {
    animation: none;
    transition: none;
  }
}
</style>
