<template>
  <div class="odd-one-out-mode">
    <!-- Setup Screen -->
    <div v-if="gameState === 'setup'" class="setup-screen">
      <div class="header">
        <button @click="$router.push('/')" class="back-button">← Back</button>
        <h1>Odd One Out</h1>
        <p>Find the invalid word among the valid ones!</p>
      </div>

      <div class="setup-card">
        <div class="section">
          <h3>1. Select Word Lists</h3>
          <div v-if="listsLoaded && installedLists.length === 0" class="notice" data-testid="no-lists">
            No word list is installed on this device yet.
            <a href="#/words" @click.prevent="$router.push('/words')">Add one on the Word lists page.</a>
          </div>
          <div v-else class="checkbox-group">
            <label v-for="list in installedLists" :key="list.id" class="checkbox-label">
              <input type="checkbox" v-model="selectedLists" :value="list.id" :data-list="list.id">
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

        <button
          class="start-button"
          :disabled="!canStart"
          @click="startGame"
        >
          {{ isMultiplayer ? 'Create Room' : 'Start Game' }}
        </button>
      </div>
    </div>

    <!-- Multiplayer Lobby -->
    <div v-else-if="gameState === 'lobby'" class="lobby-screen">
      <div class="header">
        <button @click="gameState = 'setup'" class="back-button">← Back</button>
        <h1>Waiting for Players...</h1>
      </div>

      <div class="qr-container">
        <div class="player-qr">
          <h3>Player 1</h3>
          <QRDisplay :playerId="1" :customUrl="getPlayerUrl(1)" />
          <div class="status" :class="{ connected: session?.players['1']?.connected }">
            {{ session?.players['1']?.connected ? 'Connected ✅' : 'Waiting...' }}
          </div>
        </div>
        <div class="player-qr">
          <h3>Player 2</h3>
          <QRDisplay :playerId="2" :customUrl="getPlayerUrl(2)" />
          <div class="status" :class="{ connected: session?.players['2']?.connected }">
            {{ session?.players['2']?.connected ? 'Connected ✅' : 'Waiting...' }}
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
            <h2>Look at your phones!</h2>
            <div class="timer-display big-timer">
              {{ timeLeft.toFixed(1) }}s
            </div>
          </div>

          <div v-if="session?.status === 'review'" class="result-area">
            <h2 class="correct-word-title">Correct Word: <span class="highlight">{{ currentPuzzle.words[currentPuzzle.correctIndex] }}</span></h2>
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
                  'correct': index === currentPuzzle.correctIndex,
                  'wrong': (session.players['1']?.answer === index || session.players['2']?.answer === index) && index !== currentPuzzle.correctIndex
                }"
              >
                {{ word }}
                <div class="player-badges">
                  <span v-if="session.players['1']?.answer === index" class="badge p1-badge">P1</span>
                  <span v-if="session.players['2']?.answer === index" class="badge p2-badge">P2</span>
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
        <h2>Which word is invalid?</h2>

        <div class="words-grid">
          <button
            v-for="(word, index) in currentPuzzle.words"
            :key="index"
            class="word-card"
            :class="{
              'correct': showResult && index === currentPuzzle.correctIndex,
              'wrong': showResult && selectedIndex === index && index !== currentPuzzle.correctIndex,
              'selected': selectedIndex === index
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

    <div v-else class="loading-screen">
      Loading...
    </div>
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
  slovenian: 'Slovenian'
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
    if (status) ids = LIST_IDS.filter((id) => status[id] && (status[id].shipped || status[id].imported || status[id].loaded));
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
      scores: { '1': 0, '2': 0 },
      timeLeft: 5,
      pollInterval: null,
      gameLoopInterval: null,
      roundActive: false,
      categories: [
        { id: 'two-letter', name: '2-Letter Words', icon: '✌️' },
        { id: 'three-letter', name: 'High Score 3-Letter', icon: '3️⃣' },
        { id: 'extensions', name: '3-Letter Extensions', icon: '🌱' },
        { id: 'four-letter', name: '4-Letter Words', icon: '4️⃣' },
        { id: 'five-letter', name: '5-Letter Words', icon: '5️⃣' },
        { id: 'v-words', name: 'V Words', icon: '🎯' },
        { id: 'q-no-u', name: 'Q without U', icon: '🔮' },
        { id: 'j-x-z', name: 'High Value (J,X,Z)', icon: '💎' }
      ],
      generator: null,
      currentPuzzle: null,
      selectedIndex: null,
      showResult: false,
      score: 0
    };
  },
  computed: {
    isCorrect() {
      return this.selectedIndex === this.currentPuzzle.correctIndex;
    },
    canStart() {
      return this.selectedLists.length > 0 && !!this.selectedCategory && this.corpusStatus === 'ready';
    }
  },
  watch: {
    selectedLists() {
      this.prepareCorpus();
    },
    selectedCategory() {
      this.prepareCorpus();
    }
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
        if (this.listsLoaded && this.selectedLists.length === 0) this.setupMessage = 'Pick at least one word list to play with.';
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
        this.generator = new OddOneOutGenerator({ words: this.corpus.words, isValid: this.corpus.isValid });

        if (this.isMultiplayer) {
          // Create multiplayer session
          const res = await fetch('/api/odd-one-out/create', {
            method: 'POST',
            body: JSON.stringify({ roundDuration: this.roundDuration })
          });
          const data = await res.json();
          this.sessionId = data.sessionId;
          this.scores = { '1': 0, '2': 0 };
          this.gameState = 'lobby';
          this.startLobbyPolling();
        } else {
          // Single player start
          this.score = 0;
          this.nextPuzzle();
          this.gameState = 'playing';
        }
      } catch (error) {
        console.error("Failed to start the game:", error);
        this.setupMessage = "Could not start the game: " + error.message;
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
            puzzle: this.currentPuzzle
          })
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
          console.error("Polling error", e);
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
          new Audio(assetUrl('sounds/success.mp3')).play().catch(e => debug('Audio play failed', e));
        } else {
          new Audio(assetUrl('sounds/failure.mp3')).play().catch(e => debug('Audio play failed', e));
        }
      } catch (e) {
        debug("Sound error", e);
      }

      // Update server to review state
      await fetch('/api/odd-one-out/update', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: this.sessionId,
          status: 'review'
        })
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
        alert("Could not generate puzzle: " + e.message);
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
    }
  }
};
</script>

<style scoped>
.odd-one-out-mode {
  min-height: 100vh;
  background: #1a1a2e;
  color: white;
  padding: 20px;
  font-family: 'Inter', sans-serif;
}

.setup-card {
  background: #16213e;
  padding: 30px;
  border-radius: 15px;
  max-width: 600px;
  margin: 40px auto;
}

.section {
  margin-bottom: 30px;
}

.notice {
  background: #0f3460;
  border-left: 4px solid #e94560;
  padding: 10px 14px;
  border-radius: 6px;
  margin: 10px 0 20px;
}

.notice a {
  color: #8ecbff;
}

.checkbox-group {
  display: flex;
  gap: 20px;
  margin-top: 10px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.category-btn {
  background: #0f3460;
  border: 2px solid transparent;
  padding: 15px;
  border-radius: 10px;
  color: white;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.category-btn:hover {
  background: #1f4068;
}

.category-btn.active {
  border-color: #e94560;
  background: #1f4068;
}

.start-button {
  width: 100%;
  padding: 15px;
  background: #e94560;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.2em;
  cursor: pointer;
  font-weight: bold;
}

.start-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.puzzle-container {
  max-width: 800px;
  margin: 40px auto;
  text-align: center;
}

.words-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  margin: 40px 0;
}

.word-card {
  background: #0f3460;
  color: white;
  border: 2px solid #16213e;
  padding: 20px 40px;
  font-size: 2em;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s;
  min-width: 150px;
  position: relative;
}

.word-card:hover:not(:disabled) {
  transform: translateY(-5px);
  background: #1f4068;
}

.word-card.selected {
  border-color: #fff;
}

.word-card.correct {
  background: #2ecc71;
  border-color: #27ae60;
}

.word-card.wrong {
  background: #e74c3c;
  border-color: #c0392b;
  opacity: 0.7;
}

/* Multiplayer Styles */
.duration-selector {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.duration-btn {
  padding: 10px 20px;
  background: #0f3460;
  border: 2px solid transparent;
  color: white;
  border-radius: 8px;
  cursor: pointer;
}

.duration-btn.active {
  background: #e94560;
  border-color: white;
}

.big-scoreboard {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 40px;
  margin-bottom: 40px;
}

.score-card {
  background: #16213e;
  padding: 20px 40px;
  border-radius: 15px;
  text-align: center;
  min-width: 150px;
}

.score-card .label {
  font-size: 1.2em;
  color: #a0a0a0;
  margin-bottom: 10px;
}

.score-card .value {
  font-size: 3em;
  font-weight: bold;
}

.score-card.p1 .value { color: #3498db; }
.score-card.p2 .value { color: #e74c3c; }

.vs {
  font-size: 2em;
  font-weight: bold;
  color: #666;
}

.big-timer {
  font-size: 4em;
  font-weight: bold;
  color: #e94560;
  margin: 20px 0;
}

.review-grid {
  margin-top: 30px;
}

.review-card {
  cursor: default;
  transform: none !important;
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
  font-weight: bold;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
}

.p1-badge { background: #3498db; color: white; }
.p2-badge { background: #e74c3c; color: white; }

.highlight {
  color: #2ecc71;
  text-decoration: underline;
}

.result-area {
  background: #16213e;
  padding: 20px;
  border-radius: 10px;
  margin-top: 30px;
  animation: slideUp 0.3s ease;
}

.feedback {
  font-size: 1.5em;
  font-weight: bold;
  margin-bottom: 10px;
}

.feedback.success { color: #2ecc71; }
.feedback.error { color: #e74c3c; }

.next-button {
  background: #e94560;
  color: white;
  border: none;
  padding: 10px 30px;
  border-radius: 20px;
  font-size: 1.1em;
  cursor: pointer;
  margin-top: 15px;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
