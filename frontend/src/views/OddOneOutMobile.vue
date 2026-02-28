<template>
  <div class="mobile-game">
    <div v-if="loading" class="loading">Connecting...</div>
    
    <div v-else-if="!session" class="error">
      Session not found or connection lost.
    </div>

    <div v-else-if="session.status === 'waiting'" class="waiting">
      <h1>Waiting for Host...</h1>
      <div class="player-badge">You are Player {{ playerId }}</div>
    </div>

    <div v-else-if="session.status === 'playing'" class="playing">
      <div class="timer-bar" :style="{ width: (timeLeft / (session.roundDuration || 5) * 100) + '%' }"></div>
      
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
      <h2>{{ isCorrect ? 'Correct! 🎉' : 'Wrong ❌' }}</h2>
      
      <div class="words-list">
        <div 
          v-for="(word, index) in session.puzzle.words" 
          :key="index"
          class="review-item"
          :class="{ 
            correct: index === session.puzzle.correctIndex,
            wrong: index === selectedIndex && index !== session.puzzle.correctIndex
          }"
        >
          <span class="word-text">{{ word }}</span>
          <div class="markers">
            <span v-if="index === session.puzzle.correctIndex" class="marker correct-marker">✅</span>
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
      pollInterval: null
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
    }
  },
  async created() {
    const params = new URLSearchParams(window.location.search);
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
        body: JSON.stringify({ sessionId: this.sessionId, playerId: this.playerId })
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
          answerIndex: index 
        })
      });
    }
  }
};
</script>

<style scoped>
.mobile-game {
  min-height: 100vh;
  background: #1a1a2e;
  color: white;
  padding: 20px;
  font-family: sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.waiting, .error {
  text-align: center;
}

.player-badge {
  background: #e94560;
  padding: 10px 20px;
  border-radius: 20px;
  margin-top: 20px;
  font-weight: bold;
}

.timer-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 10px;
  background: #e94560;
  transition: width 0.1s linear;
}

.words-grid {
  display: grid;
  gap: 15px;
  width: 100%;
  max-width: 400px;
}

.word-btn {
  background: #16213e;
  border: 2px solid #0f3460;
  color: white;
  padding: 20px;
  font-size: 1.5em;
  border-radius: 10px;
  width: 100%;
}

.word-btn.selected {
  background: #e94560;
  border-color: white;
}

.review-item {
  background: #16213e;
  padding: 15px;
  margin: 10px 0;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.review-item.correct {
  border: 2px solid #2ecc71;
}

.review-item.wrong {
  border: 2px solid #e74c3c;
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

.me-marker {
  background: #3498db;
  color: white;
}

.opp-marker {
  background: #f1c40f;
  color: black;
}
</style>
