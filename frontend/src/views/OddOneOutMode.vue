<template>
  <div class="odd-one-out-mode">
    <!-- Setup Screen -->
    <div v-if="gameState === 'setup'" class="setup-screen">
      <div class="header">
        <button @click="$router.push('/')" class="back-button">← Back</button>
        <h1>Odd One Out</h1>
        <p>Find the invalid word.</p>
      </div>

      <div class="setup-card">
        <div class="section">
          <h3>1. Select Word Lists</h3>
          <div
            v-if="listsLoaded && installedLists.length === 0"
            class="notice"
            data-testid="no-lists"
          >
            No word list is installed on this device yet.
            <a href="#/words" @click.prevent="$router.push('/words')"
              >Add one on the Word lists page.</a
            >
          </div>
          <div v-else class="checkbox-group">
            <label v-for="list in installedLists" :key="list.id" class="checkbox-label">
              <input
                type="checkbox"
                v-model="selectedLists"
                :value="list.id"
                :data-list="list.id"
              />
              {{ list.label }}
            </label>
          </div>
        </div>

        <div class="section">
          <h3>2. Select Category</h3>
          <div class="categories-grid">
            <button
              v-for="cat in categories"
              :key="cat.id"
              class="category-btn"
              :class="{ active: selectedCategory === cat.id }"
              @click="selectedCategory = cat.id"
            >
              <span class="icon">{{ cat.icon }}</span>
              <span class="name">{{ cat.name }}</span>
            </button>
          </div>
        </div>

        <div class="section">
          <h3>3. Game Mode</h3>
          <div class="mode-toggle">
            <button
              class="toggle-btn"
              :class="{ active: !isMultiplayer }"
              @click="isMultiplayer = false"
            >
              Single Player
            </button>
            <button
              v-if="canMultiplayer"
              class="toggle-btn"
              :class="{ active: isMultiplayer }"
              @click="isMultiplayer = true"
            >
              Multiplayer (2 Phones)
            </button>
          </div>
        </div>

        <div class="section" v-if="isMultiplayer">
          <h3>4. Round Duration</h3>
          <div class="duration-selector">
            <button
              v-for="sec in [5, 10, 15, 20, 30]"
              :key="sec"
              class="duration-btn"
              :class="{ active: roundDuration === sec }"
              @click="roundDuration = sec"
            >
              {{ sec }}s
            </button>
          </div>
        </div>

        <p v-if="setupMessage" class="notice" data-testid="setup-message">{{ setupMessage }}</p>

        <button class="start-button" :disabled="!canStart" @click="startGame">
          {{ isMultiplayer ? 'Create Room' : 'Start Game' }}
        </button>
      </div>
    </div>

    <!-- Multiplayer Lobby -->
    <div v-else-if="gameState === 'lobby'" class="lobby-screen">
      <div class="header">
        <button @click="gameState = 'setup'" class="back-button">← Back</button>
        <h1>Waiting for players</h1>
      </div>

      <div class="qr-container">
        <div class="player-qr">
          <h3>Player 1</h3>
          <QRDisplay :playerId="1" :customUrl="getPlayerUrl(1)" />
          <div class="status" :class="{ connected: session?.players['1']?.connected }">
            {{ session?.players['1']?.connected ? 'Connected' : 'Waiting' }}
          </div>
        </div>
        <div class="player-qr">
          <h3>Player 2</h3>
          <QRDisplay :playerId="2" :customUrl="getPlayerUrl(2)" />
          <div class="status" :class="{ connected: session?.players['2']?.connected }">
            {{ session?.players['2']?.connected ? 'Connected' : 'Waiting' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Multiplayer Game Screen -->
    <div v-else-if="gameState === 'multiplayer_playing'" class="game-screen">
      <div class="game-header">
        <button @click="gameState = 'setup'" class="back-button">Exit</button>
      </div>

      <div class="multiplayer-content">
        <!-- Big Scoreboard -->
        <div class="big-scoreboard">
          <div class="score-card p1">
            <div class="label">Player 1</div>
            <div class="value">{{ scores['1'] }}</div>
          </div>
          <div class="vs">VS</div>
          <div class="score-card p2">
            <div class="label">Player 2</div>
            <div class="value">{{ scores['2'] }}</div>
          </div>
        </div>

        <div class="puzzle-container">
          <div v-if="session?.status === 'playing'">
            <h2>Round in progress.</h2>
            <div class="timer-display big-timer">{{ timeLeft.toFixed(1) }}s</div>
          </div>

          <div v-if="session?.status === 'review'" class="result-area">
            <h2 class="correct-word-title">
              Correct word:
              <span class="highlight">{{ currentPuzzle.words[currentPuzzle.correctIndex] }}</span>
            </h2>
            <div class="feedback">
              {{ currentPuzzle.explanation }}
            </div>

            <!-- Show the grid with player choices -->
            <div class="words-grid review-grid">
              <div
                v-for="(word, index) in currentPuzzle.words"
                :key="index"
                class="word-card review-card"
                :class="{
                  correct: index === currentPuzzle.correctIndex,
                  wrong:
                    (session.players['1']?.answer === index ||
                      session.players['2']?.answer === index) &&
                    index !== currentPuzzle.correctIndex,
                }"
              >
                {{ word }}
                <div class="player-badges">
                  <span v-if="session.players['1']?.answer === index" class="badge p1-badge"
                    >P1</span
                  >
                  <span v-if="session.players['2']?.answer === index" class="badge p2-badge"
                    >P2</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Single Player Game Screen -->
    <div v-else-if="gameState === 'playing'" class="game-screen">
      <div class="game-header">
        <button @click="gameState = 'setup'" class="back-button">Exit</button>
        <div class="score">Score: {{ score }}</div>
      </div>

      <div class="puzzle-container">
        <h2>Select the invalid word.</h2>

        <div class="words-grid">
          <button
            v-for="(word, index) in currentPuzzle.words"
            :key="index"
            class="word-card"
            :class="{
              correct: showResult && index === currentPuzzle.correctIndex,
              wrong: showResult && selectedIndex === index && index !== currentPuzzle.correctIndex,
              selected: selectedIndex === index,
            }"
            @click="selectWord(index)"
            :disabled="showResult"
          >
            {{ word }}
          </button>
        </div>

        <div v-if="showResult" class="result-area">
          <div class="feedback" :class="isCorrect ? 'success' : 'error'">
            {{ isCorrect ? 'Correct!' : 'Oops!' }}
          </div>
          <p class="explanation">{{ currentPuzzle.explanation }}</p>
          <button class="next-button" @click="nextPuzzle">Next Puzzle →</button>
        </div>
      </div>
    </div>

    <div v-else class="loading-screen">Loading</div>
  </div>
</template>

<script>
import { assetUrl, appUrl } from '../utils/url';
import { OddOneOutGenerator } from '../game/oddOneOut/generator';
import { loadCorpus, MIN_CORPUS_WORDS } from '../game/oddOneOut/corpus';
import { getBackend } from '../net/api';
import { resolveMode } from '../net/mode';
import QRDisplay from '../components/QRDisplay.vue';
import { debug } from '../utils/log';

// The word lists the app knows, best first; labels as shown to the player
const LIST_LABELS = {
  csw21: 'CSW21',
  nwl2023: 'NWL2023',
  enable: 'ENABLE (open list)',
  slovenian: 'Slovenian',
};
const LIST_IDS = Object.keys(LIST_LABELS);

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

/** Ids of the installed lists, in LIST_IDS order: from the in-browser backend (standalone) or the laptop's file list. */
async function findInstalledLists() {
  let ids = null;
  if (resolveMode() === 'local') {
    const status = await getBackend()?.listStatus?.();
    if (status)
      ids = LIST_IDS.filter(
        (id) => status[id] && (status[id].shipped || status[id].imported || status[id].loaded)
      );
  }
  if (!ids) {
    const response = await fetch(assetUrl('wordlists.json'));
    const { lists } = await response.json();
    ids = LIST_IDS.filter((id) => lists && lists[id]);
  }
  return ids;
}

export default {
  name: 'OddOneOutMode',
  components: { QRDisplay },
  data() {
    return {
      gameState: 'setup', // setup, loading, playing, lobby, multiplayer_playing
      installedLists: [],
      listsLoaded: false,
      selectedLists: [],
      canMultiplayer: resolveMode() === 'http', // the two-phone game needs the laptop server
      corpus: null,
      corpusStatus: 'idle', // idle, loading, ready, error
      corpusToken: 0,
      setupMessage: '',
      selectedCategory: null,
      isMultiplayer: false,
      roundDuration: 5,
      sessionId: null,
      session: null,
      scores: { 1: 0, 2: 0 },
      timeLeft: 5,
      pollInterval: null,
      gameLoopInterval: null,
      roundActive: false,
      categories: [
        { id: 'two-letter', name: '2-Letter Words', icon: '2L' },
        { id: 'three-letter', name: 'High Score 3-Letter', icon: '3L' },
        { id: 'extensions', name: '3-Letter Extensions', icon: '+1' },
        { id: 'four-letter', name: '4-Letter Words', icon: '4L' },
        { id: 'five-letter', name: '5-Letter Words', icon: '5L' },
        { id: 'v-words', name: 'V Words', icon: 'V' },
        { id: 'q-no-u', name: 'Q without U', icon: 'Q' },
        { id: 'j-x-z', name: 'High Value (J,X,Z)', icon: 'JXZ' },
      ],
      generator: null,
      currentPuzzle: null,
      selectedIndex: null,
      showResult: false,
      score: 0,
    };
  },
  computed: {
    isCorrect() {
      return this.selectedIndex === this.currentPuzzle.correctIndex;
    },
    canStart() {
      return (
        this.selectedLists.length > 0 && !!this.selectedCategory && this.corpusStatus === 'ready'
      );
    },
  },
  watch: {
    selectedLists() {
      this.prepareCorpus();
    },
    selectedCategory() {
      this.prepareCorpus();
    },
  },
  async mounted() {
    try {
      const ids = await findInstalledLists();
      this.installedLists = ids.map((id) => ({ id, label: LIST_LABELS[id] }));
      this.selectedLists = await this.defaultSelection(ids);
    } catch (error) {
      console.error('Could not find the word lists:', error);
      this.setupMessage = 'Could not find out which word lists are installed.';
    }
    this.listsLoaded = true;
  },
  beforeUnmount() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
  },
  methods: {
    /** The lists of the game in progress (when installed), else the best installed one. */
    async defaultSelection(installed) {
      try {
        const state = await fetchJson('/api/game-state');
        const inGame = installed.filter((id) => state?.dictionaries?.[id]);
        if (inGame.length) return inGame;
      } catch (error) {
        debug('No game state to take the word lists from', error);
      }
      return installed.length ? [installed[0]] : [];
    },
    /** Load the words of the chosen category and say whether there are enough for a puzzle. */
    async prepareCorpus() {
      const token = ++this.corpusToken;
      this.corpus = null;
      this.setupMessage = '';
      if (this.selectedLists.length === 0 || !this.selectedCategory) {
        this.corpusStatus = 'idle';
        if (this.listsLoaded && this.selectedLists.length === 0)
          this.setupMessage = 'Pick at least one word list to play with.';
        return;
      }
      this.corpusStatus = 'loading';
      try {
        const corpus = await loadCorpus(this.selectedCategory, [...this.selectedLists], fetchJson);
        if (token !== this.corpusToken) return; // the player has changed the choice meanwhile
        this.corpus = corpus;
        if (corpus.words.length < MIN_CORPUS_WORDS) {
          this.corpusStatus = 'error';
          this.setupMessage = `This category has only ${corpus.words.length} word${corpus.words.length === 1 ? '' : 's'} in the chosen word list${this.selectedLists.length === 1 ? '' : 's'}; a puzzle needs at least ${MIN_CORPUS_WORDS}. Try another category or word list.`;
        } else {
          this.corpusStatus = 'ready';
        }
      } catch (error) {
        if (token !== this.corpusToken) return;
        console.error('Failed to load the words:', error);
        this.corpusStatus = 'error';
        this.setupMessage = 'Could not load the words of this category. Please try another.';
      }
    },
    async startGame() {
      if (!this.canStart) return;
      this.gameState = 'loading';
      try {
        this.generator = new OddOneOutGenerator({
          words: this.corpus.words,
          isValid: this.corpus.isValid,
        });

        if (this.isMultiplayer) {
          // Create multiplayer session
          const res = await fetch('/api/odd-one-out/create', {
            method: 'POST',
            body: JSON.stringify({ roundDuration: this.roundDuration }),
          });
          const data = await res.json();
          this.sessionId = data.sessionId;
          this.scores = { 1: 0, 2: 0 };
          this.gameState = 'lobby';
          this.startLobbyPolling();
        } else {
          // Single player start
          this.score = 0;
          this.nextPuzzle();
          this.gameState = 'playing';
        }
      } catch (error) {
        console.error('Failed to start the game:', error);
        this.setupMessage = 'Could not start the game: ' + error.message;
        this.gameState = 'setup';
      }
    },
    getPlayerUrl(id) {
      return appUrl(`/odd-one-out-mobile?sessionId=${this.sessionId}&playerId=${id}`);
    },
    startLobbyPolling() {
      this.pollInterval = setInterval(async () => {
        const res = await fetch(`/api/odd-one-out/state?sessionId=${this.sessionId}`);
        this.session = await res.json();

        // Check if both players connected
        if (this.session.players['1']?.connected && this.session.players['2']?.connected) {
          clearInterval(this.pollInterval);
          this.startMultiplayerGame();
        }
      }, 1000);
    },
    async startMultiplayerGame() {
      this.gameState = 'multiplayer_playing';
      this.nextMultiplayerPuzzle();
    },
    async nextMultiplayerPuzzle() {
      try {
        this.currentPuzzle = this.generator.generatePuzzle();

        // Update server state
        await fetch('/api/odd-one-out/update', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: this.sessionId,
            status: 'playing',
            puzzle: this.currentPuzzle,
          }),
        });

        this.startRoundTimer();
      } catch (e) {
        console.error(e);
      }
    },
    startRoundTimer() {
      this.timeLeft = this.roundDuration;
      const startTime = Date.now();
      this.roundActive = true;

      if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);

      this.gameLoopInterval = setInterval(async () => {
        if (!this.roundActive) {
          clearInterval(this.gameLoopInterval);
          return;
        }

        // Update timer
        const elapsed = (Date.now() - startTime) / 1000;
        this.timeLeft = Math.max(0, this.roundDuration - elapsed);

        // Poll for answers
        try {
          const res = await fetch(`/api/odd-one-out/state?sessionId=${this.sessionId}`);
          this.session = await res.json();

          const p1Ans = this.session.players['1']?.answer;
          const p2Ans = this.session.players['2']?.answer;

          // Check if round over
          if (this.roundActive && (this.timeLeft === 0 || (p1Ans !== null && p2Ans !== null))) {
            this.roundActive = false;
            clearInterval(this.gameLoopInterval);
            this.endRound(p1Ans, p2Ans);
          }
        } catch (e) {
          console.error('Polling error', e);
        }
      }, 100);
    },
    async endRound(p1Ans, p2Ans) {
      // Calculate scores
      let p1Correct = p1Ans === this.currentPuzzle.correctIndex;
      let p2Correct = p2Ans === this.currentPuzzle.correctIndex;

      if (p1Correct) this.scores['1'] += 10;
      if (p2Correct) this.scores['2'] += 10;

      // Play sounds
      try {
        if (p1Correct || p2Correct) {
          new Audio(assetUrl('sounds/success.mp3'))
            .play()
            .catch((e) => debug('Audio play failed', e));
        } else {
          new Audio(assetUrl('sounds/failure.mp3'))
            .play()
            .catch((e) => debug('Audio play failed', e));
        }
      } catch (e) {
        debug('Sound error', e);
      }

      // Update server to review state
      await fetch('/api/odd-one-out/update', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: this.sessionId,
          status: 'review',
        }),
      });

      // Wait 5 seconds then next puzzle
      setTimeout(() => {
        if (this.gameState === 'multiplayer_playing') {
          this.nextMultiplayerPuzzle();
        }
      }, 5000);
    },
    getPlayerResult(id) {
      const ans = this.session.players[id]?.answer;
      if (ans === null) return 'No Answer';
      return ans === this.currentPuzzle.correctIndex ? 'Correct (+10)' : 'Wrong';
    },
    nextPuzzle() {
      try {
        this.currentPuzzle = this.generator.generatePuzzle();
        this.selectedIndex = null;
        this.showResult = false;
      } catch (e) {
        alert('Could not generate puzzle: ' + e.message);
        this.gameState = 'setup';
      }
    },
    selectWord(index) {
      if (this.showResult) return;
      this.selectedIndex = index;
      this.showResult = true;
      if (this.isCorrect) {
        this.score += 10;
      }
    },
  },
};
</script>

<style scoped>
/* why: page stays flat surface-0; cards carry the matte surface + edge + glint. */
.odd-one-out-mode {
  min-height: 100vh;
  background: var(--surface-0);
  color: var(--ink);
  padding: 20px;
}

.setup-screen,
.lobby-screen,
.game-screen,
.loading-screen {
  max-width: 960px;
  margin: 0 auto;
}

.header {
  text-align: center;
  margin-bottom: 8px;
}

.header h1 {
  margin: 12px 0 4px;
  color: var(--ink);
}

.header p {
  margin: 0 0 8px;
  color: var(--ink-muted);
}

.back-button {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 0.95em;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.back-button:hover:not(:disabled) {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.back-button:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.back-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.setup-card {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  padding: 30px;
  border-radius: 14px;
  max-width: 600px;
  margin: 40px auto;
}

.section {
  margin-bottom: 30px;
}

.section h3 {
  margin: 0 0 8px;
  color: var(--ink);
  font-size: 1em;
}

/* why: caution reads as warn; info text stays on the ink ladder. */
.notice {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  border-left: 4px solid var(--warn);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink);
  padding: 10px 14px;
  border-radius: 6px;
  margin: 10px 0 20px;
}

.notice a {
  color: var(--accent);
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-top: 10px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--ink);
}

.checkbox-label input {
  accent-color: var(--accent);
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.category-btn {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  padding: 15px;
  border-radius: 10px;
  color: var(--ink);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.category-btn:hover:not(:disabled) {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.category-btn:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.category-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

/* why: selection spends accent, never a hand-picked hue. */
.category-btn.active {
  border-color: var(--accent-edge);
  background: var(--accent-soft);
  color: var(--ink);
}

.category-btn .icon {
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--ink-muted);
}

.category-btn.active .icon {
  color: var(--ink);
}

.category-btn .name {
  color: var(--ink);
  font-size: 0.85em;
  text-align: center;
}

.mode-toggle {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.toggle-btn {
  padding: 10px 20px;
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink-muted);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out),
    opacity var(--dur-quick) var(--ease-out);
}

.toggle-btn:hover:not(:disabled) {
  border-color: var(--accent-edge);
  color: var(--ink);
  transform: translateY(-1px);
}

.toggle-btn:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.toggle-btn.active {
  background: var(--accent-soft);
  border-color: var(--accent-edge);
  color: var(--ink);
}

.toggle-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.start-button {
  width: 100%;
  padding: 15px;
  background: var(--primary);
  color: var(--on-primary);
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 1.2em;
  cursor: pointer;
  font-weight: 700;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out),
    opacity var(--dur-quick) var(--ease-out);
}

.start-button:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.start-button:active:not(:disabled) {
  background: var(--primary-pressed);
  transform: scale(0.97);
  transition-duration: 60ms;
}

.start-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.score {
  color: var(--ink-muted);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.puzzle-container {
  max-width: 800px;
  margin: 40px auto;
  text-align: center;
}

.puzzle-container h2 {
  color: var(--ink);
  margin: 0 0 8px;
}

.words-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  margin: 40px 0;
}

.word-card {
  background: var(--surface-2);
  color: var(--ink);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  padding: 20px 40px;
  font-size: 2em;
  border-radius: 12px;
  cursor: pointer;
  min-width: 150px;
  position: relative;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.word-card:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: var(--accent-edge);
}

.word-card:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.word-card:disabled {
  cursor: default;
}

/* why: selection is accent; verdicts keep to themselves in success/danger. */
.word-card.selected {
  border-color: var(--accent-edge);
  background: var(--accent-soft);
}

.word-card.correct {
  background: var(--success-soft);
  border-color: var(--success-edge);
  color: var(--success);
}

.word-card.wrong {
  background: var(--danger-soft);
  border-color: var(--danger-edge);
  color: var(--danger);
}

/* Multiplayer Styles */
.duration-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.duration-btn {
  padding: 10px 20px;
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink-muted);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.duration-btn:hover:not(:disabled) {
  border-color: var(--accent-edge);
  color: var(--ink);
  transform: translateY(-1px);
}

.duration-btn:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.duration-btn.active {
  background: var(--accent-soft);
  border-color: var(--accent-edge);
  color: var(--ink);
}

.duration-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.multiplayer-content {
  display: grid;
  gap: 16px;
}

.big-scoreboard {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 40px;
  margin-bottom: 40px;
}

.score-card {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  padding: 20px 40px;
  border-radius: 15px;
  text-align: center;
  min-width: 150px;
}

.score-card .label {
  font-size: 1.2em;
  color: var(--ink-muted);
  margin-bottom: 10px;
}

.score-card .value {
  font-size: 3em;
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

/* why: seat chips stay neutral so no hue is spent where a number names the seat. */
.score-card.p1 .value,
.score-card.p2 .value {
  color: var(--ink);
}

.vs {
  font-size: 2em;
  font-weight: 700;
  color: var(--ink-faint);
}

.timer-display {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.big-timer {
  font-size: 4em;
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  margin: 20px 0;
}

.correct-word-title {
  color: var(--ink);
  margin: 0 0 8px;
}

.review-grid {
  margin-top: 30px;
}

.review-card {
  cursor: default;
}

.review-card:hover:not(:disabled) {
  transform: none;
}

.player-badges {
  position: absolute;
  top: -10px;
  right: -10px;
  display: flex;
  gap: 5px;
}

.badge {
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.8em;
  font-weight: 700;
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  color: var(--ink-muted);
  box-shadow: var(--shadow-sm);
  font-variant-numeric: tabular-nums;
}

.p1-badge,
.p2-badge {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  color: var(--ink-muted);
}

.highlight {
  color: var(--success);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.result-area {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  padding: 20px;
  border-radius: 10px;
  margin-top: 30px;
  /* why: entrances play once and settle; nothing loops. */
  animation: slideUp var(--dur-settle) var(--ease-out) both;
}

.feedback {
  font-size: 1.5em;
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--ink);
}

.feedback.success {
  color: var(--success);
}
.feedback.error {
  color: var(--danger);
}

.explanation {
  color: var(--ink-muted);
  margin: 0;
}

.next-button {
  background: var(--primary);
  color: var(--on-primary);
  border: 1px solid transparent;
  padding: 10px 30px;
  border-radius: 20px;
  font-size: 1.1em;
  font-weight: 600;
  cursor: pointer;
  margin-top: 15px;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out),
    opacity var(--dur-quick) var(--ease-out);
}

.next-button:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.next-button:active:not(:disabled) {
  background: var(--primary-pressed);
  transform: scale(0.97);
  transition-duration: 60ms;
}

.next-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.qr-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  margin-top: 24px;
}

.player-qr {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  min-width: 220px;
}

.player-qr h3 {
  margin: 0 0 8px;
  color: var(--ink);
}

.status {
  margin-top: 8px;
  color: var(--ink-muted);
  font-weight: 600;
}

.status.connected {
  color: var(--success);
}

.loading-screen {
  padding: 48px 20px;
  text-align: center;
  color: var(--ink-muted);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
