<template>
  <div class="mobile-game">
    <div v-if="loading" class="loading">Connecting...</div>

    <div v-else-if="!session" class="error">Session not found or connection lost.</div>

    <div v-else-if="session.status === 'waiting'" class="waiting">
      <h1>Waiting for Host...</h1>
      <div class="player-badge">Player {{ playerId }}</div>
    </div>

    <div v-else-if="session.status === 'playing'" class="playing">
      <div
        class="timer-bar"
        :style="{ transform: `scaleX(${timeLeft / (session.roundDuration || 5)})` }"
      ></div>

      <div class="words-grid">
        <button
          v-for="(word, index) in session.puzzle.words"
          :key="index"
          class="word-btn"
          :class="{ selected: selectedIndex === index }"
          @click="submitAnswer(index)"
          :disabled="selectedIndex !== null"
        >
          {{ word }}
        </button>
      </div>
    </div>

    <div v-else-if="session.status === 'review'" class="review">
      <h2>{{ isCorrect ? 'Correct' : 'Not quite' }}</h2>

      <div class="words-list">
        <div
          v-for="(word, index) in session.puzzle.words"
          :key="index"
          class="review-item"
          :class="{
            correct: index === session.puzzle.correctIndex,
            wrong: index === selectedIndex && index !== session.puzzle.correctIndex,
          }"
        >
          <span class="word-text">{{ word }}</span>
          <div class="markers">
            <span v-if="index === session.puzzle.correctIndex" class="marker correct-marker"
              >Odd one out</span
            >
            <span v-if="selectedIndex === index" class="marker me-marker">You</span>
            <span v-if="opponentAnswer === index" class="marker opp-marker">P{{ opponentId }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'OddOneOutMobile',
  data() {
    return {
      sessionId: null,
      playerId: null,
      session: null,
      loading: true,
      selectedIndex: null,
      timeLeft: 5,
      timerInterval: null,
      pollInterval: null,
    };
  },
  computed: {
    isCorrect() {
      return this.selectedIndex === this.session.puzzle.correctIndex;
    },
    opponentId() {
      return this.playerId === '1' ? '2' : '1';
    },
    opponentAnswer() {
      return this.session.players[this.opponentId]?.answer;
    },
  },
  async created() {
    const params = new URLSearchParams(this.$route.query);
    this.sessionId = params.get('sessionId');
    this.playerId = params.get('playerId');

    if (!this.sessionId || !this.playerId) {
      this.loading = false;
      return;
    }

    // Join session
    try {
      await fetch('/api/odd-one-out/join', {
        method: 'POST',
        body: JSON.stringify({ sessionId: this.sessionId, playerId: this.playerId }),
      });

      this.startPolling();
    } catch (e) {
      console.error(e);
    }
  },
  beforeUnmount() {
    clearInterval(this.pollInterval);
    clearInterval(this.timerInterval);
  },
  methods: {
    startPolling() {
      this.pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/odd-one-out/state?sessionId=${this.sessionId}`);
          const data = await res.json();

          // Detect state change to playing
          if (this.session?.status !== 'playing' && data.status === 'playing') {
            this.startTimer();
            this.selectedIndex = null;
          }

          this.session = data;
          this.loading = false;
        } catch (e) {
          console.error(e);
        }
      }, 500);
    },
    startTimer() {
      this.timeLeft = this.session.roundDuration || 5;
      clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        this.timeLeft -= 0.1;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          clearInterval(this.timerInterval);
        }
      }, 100);
    },
    async submitAnswer(index) {
      this.selectedIndex = index;
      await fetch('/api/odd-one-out/submit', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: this.sessionId,
          playerId: this.playerId,
          answerIndex: index,
        }),
      });
    },
  },
};
</script>

<style scoped>
.mobile-game {
  min-height: 100vh;
  background: var(--surface-0);
  color: var(--ink);
  padding: 20px;
  font-family: sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.waiting,
.error {
  text-align: center;
}

.player-badge {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  color: var(--ink);
  padding: 10px 20px;
  border-radius: 999px;
  margin-top: 20px;
  font-weight: bold;
}

.timer-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 6px;
  background: var(--accent);
  /* Progress advances on transform, never on layout (R15). */
  transform-origin: left center;
  transition: transform 0.1s linear;
}

.playing {
  width: 100%;
  max-width: 400px;
}

.words-grid {
  display: grid;
  gap: 12px;
  width: 100%;
  max-width: 400px;
  margin-top: 24px;
}

.word-btn {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink);
  padding: 20px;
  font-size: 1.5em;
  border-radius: 10px;
  width: 100%;
  min-height: 64px;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.word-btn:hover:not(:disabled) {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.word-btn.selected {
  background: var(--accent-soft);
  border-color: var(--accent-edge);
}

.word-btn:disabled {
  cursor: default;
}

.review {
  width: 100%;
  max-width: 400px;
}

.review h2 {
  text-align: center;
  color: var(--ink);
}

/* Verdicts are fill + ink with the glow off (R7): right and wrong keep the
   verdict to themselves. */
.review-item {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  padding: 15px;
  margin: 10px 0;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.review-item.correct {
  border-color: var(--success-edge);
  background: var(--success-soft);
}

.review-item.wrong {
  border-color: var(--danger-edge);
  background: var(--danger-soft);
}

.markers {
  display: flex;
  gap: 5px;
  align-items: center;
}

.marker {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  font-weight: bold;
}

.correct-marker {
  color: var(--success);
}

.me-marker {
  background: var(--accent-soft);
  border: 1px solid var(--accent-edge);
  color: var(--ink);
}

.opp-marker {
  background: var(--surface-3);
  border: 1px solid var(--surface-edge);
  color: var(--ink-muted);
}
</style>
