<template>
  <div id="home">
    <div class="home-container">
      <h1 class="game-title" data-testid="home-title">
        Oxyphenbutazone <em>word tiles, phone to phone.</em>
      </h1>
      <p class="game-subtitle">Take one. Nothing here has to stay.</p>

      <div class="mode-cards">
        <div class="mode-card game-mode-card">
          <p class="mode-eyebrow">Two to four players</p>
          <h2>Regular Game</h2>
          <p>Competitive mode with turns, scoring, and mobile rack support</p>

          <!-- Player Count Selector -->
          <div class="player-selector">
            <div class="player-selector-label">Number of Players:</div>
            <div class="player-buttons">
              <button
                v-for="num in [2, 3, 4]"
                :key="num"
                class="player-count-btn"
                :class="{ active: selectedPlayerCount === num }"
                @click.stop="selectedPlayerCount = num"
              >
                <span class="player-count-number">{{ num }}</span>
              </button>
            </div>
          </div>

          <!-- Language Selector: fixed for the whole game -->
          <div class="player-selector">
            <div class="player-selector-label">Language (tiles &amp; dictionary):</div>
            <div class="player-buttons">
              <button
                v-for="lang in languages"
                :key="lang.id"
                class="player-count-btn"
                :class="{ active: selectedLanguage === lang.id }"
                @click.stop="selectedLanguage = lang.id"
              >
                <span class="player-count-number lang-code">{{ lang.code }}</span>
                <span class="player-count-label">{{ lang.label }}</span>
              </button>
            </div>
          </div>

          <button @click="goToGame" class="mode-button" data-testid="start-game-btn">
            Start {{ selectedPlayerCount }}-Player Game
          </button>
        </div>

        <div v-if="!hasLaptopHost" class="mode-card game-mode-card">
          <p class="mode-eyebrow">Same room, no server</p>
          <h2>Play with a friend</h2>
          <p>
            Two phones, no server, no internet needed once installed. One hosts, the other joins.
          </p>
          <button class="mode-button" @click="$router.push('/host')">Host a game</button>
          <button class="mode-button" @click="$router.push('/join')">Join a game</button>
        </div>

        <div class="mode-card" @click="goToFreePlay">
          <p class="mode-eyebrow">Explore</p>
          <h2>Free Play</h2>
          <p>Unlimited tile placement to explore words, prefixes, and suffixes</p>
          <button class="mode-button">Start Free Play</button>
        </div>

        <div class="mode-card" @click="goToFlashcards">
          <p class="mode-eyebrow">Study</p>
          <h2>Word Practice</h2>
          <p>Learn words with flashcards and practice scenarios</p>
          <button class="mode-button">Practice Words</button>
        </div>

        <div class="mode-card" @click="goToPractice">
          <p class="mode-eyebrow">Puzzles</p>
          <h2>Scenarios</h2>
          <p>Solve specific board puzzles and find the best moves</p>
          <button class="mode-button">Solve Puzzles</button>
        </div>

        <div class="mode-card" @click="goToOddOneOut">
          <p class="mode-eyebrow">Spot the intruder</p>
          <h2>Odd One Out</h2>
          <p>Find the invalid word among valid ones</p>
          <button class="mode-button">Play Now</button>
        </div>

        <div class="mode-card" @click="goToHistory">
          <p class="mode-eyebrow">Move by move</p>
          <h2>Game History</h2>
          <p>Review and analyze your past games move by move</p>
          <button class="mode-button">View History</button>
        </div>
      </div>

      <p v-if="!hasLaptopHost" class="footer-link">
        <a href="#/words" @click.prevent="$router.push('/words')">Word lists</a>
      </p>
    </div>
  </div>
</template>

<script>
import { resolveMode } from '../net/mode';

export default {
  name: 'Home',
  data() {
    return {
      selectedPlayerCount: 4, // Default to 4 players
      hasLaptopHost: resolveMode() === 'http', // odd-one-out multiplayer needs the dev server
      selectedLanguage: 'english',
      languages: [
        { id: 'english', code: 'EN', label: 'English' },
        { id: 'slovenian', code: 'SL', label: 'Slovenščina' },
      ],
    };
  },
  methods: {
    goToGame() {
      this.$router.push({
        path: '/game',
        query: {
          players: this.selectedPlayerCount,
          language: this.selectedLanguage,
          newGame: 'true',
        },
      });
    },
    goToFreePlay() {
      this.$router.push('/freeplay');
    },
    goToFlashcards() {
      this.$router.push('/flashcards');
    },
    goToPractice() {
      this.$router.push('/practice');
    },
    goToOddOneOut() {
      this.$router.push('/odd-one-out');
    },
    goToHistory() {
      this.$router.push('/history');
    },
  },
};
</script>

<style scoped>
/* Salon register (§13): the arrival screen shares the ground and the ink but
   speaks differently — Georgia headline with an amber tail, mono eyebrows,
   matte 4px cards, one amber button. No gradients, no glass, no loops. */
#home {
  font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--surface-0);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink);
  padding: 20px;
}

.home-container {
  max-width: 1000px;
  width: 100%;
  text-align: center;
}

.game-title {
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 400;
  font-size: clamp(34px, 3.45vw, 54px);
  line-height: 1.13;
  letter-spacing: -0.02em;
  margin: 0 0 10px 0;
  color: var(--ink);
}

/* The amber tail: the salon's one warm accent, shared with the buttons below
   so the colour is checked by a crossing (R26), never decoration (R1). */
.game-title em {
  font-style: italic;
  color: #e8b76e;
}

[data-theme='light'] .game-title em {
  color: #7a4d0d;
}

.game-subtitle {
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-muted);
  margin: 0 auto 10px;
  max-width: 450px;
}

.mode-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px;
  margin-top: 40px;
}

.mode-card {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  border-radius: 4px;
  padding: 40px 30px;
  box-shadow: inset 0 1px 0 var(--surface-glint);
  transition:
    transform 450ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    border-color var(--dur-quick, 160ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.mode-card:not(.game-mode-card) {
  cursor: pointer;
}

.mode-card:not(.game-mode-card):hover {
  transform: translateY(-4px);
  border-color: var(--accent-edge);
}

.game-mode-card:hover {
  border-color: var(--surface-edge);
}

.mode-eyebrow {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--ink-muted);
  margin: 0 0 16px 0;
}

.mode-card h2 {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0 0 12px 0;
  color: var(--ink);
}

.mode-card p:not(.mode-eyebrow) {
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 1.7;
  margin: 0 auto 30px;
  max-width: 450px;
  min-height: 60px;
}

.mode-button {
  background: #e8bc7c;
  border: 1px solid #e8bc7c;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.2);
  color: #1a1a2e;
  padding: 12px 30px;
  font-size: 0.85rem;
  font-weight: 700;
  border-radius: 3px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition:
    transform var(--dur-quick, 160ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    filter var(--dur-quick, 160ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.mode-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

.mode-button:active {
  transform: translateY(0) scale(0.97);
  transition-duration: 60ms;
}

.player-selector {
  margin: 25px 0;
  padding: 20px;
  background: var(--surface-2);
  border-radius: 8px;
  border: 1px solid var(--surface-edge);
}

.player-selector-label {
  font-size: 0.95rem;
  color: var(--ink-muted);
  margin-bottom: 15px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
}

.player-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.player-count-btn {
  flex: 1;
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  color: var(--ink-muted);
  padding: 15px 10px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition:
    transform var(--dur-quick, 160ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    border-color var(--dur-quick, 160ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color var(--dur-quick, 160ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.player-count-btn:hover {
  transform: translateY(-1px);
  border-color: var(--accent-edge);
  color: var(--ink);
}

.player-count-btn.active {
  border-color: #e8bc7c;
  background: color-mix(in oklab, #e8bc7c 12%, var(--surface-2));
  color: var(--ink);
}

.player-count-number {
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.player-count-number.lang-code {
  font-size: 1.4rem;
  letter-spacing: 0.08em;
}

.player-count-label {
  font-size: 0.85rem;
  line-height: 1.4;
}

.footer-link {
  margin: 30px 0 0;
  font-size: 0.95rem;
}

.footer-link a {
  color: var(--accent);
}

@media (max-width: 768px) {
  .mode-cards {
    grid-template-columns: 1fr;
  }

  .player-buttons {
    gap: 8px;
  }

  .player-count-btn {
    padding: 12px 8px;
  }

  .player-count-number {
    font-size: 1.5rem;
  }
}
</style>
