<template>
  <div class="mobile-rack-view">
    <div class="header">
      <h1>{{ playerName }}</h1>
      <div class="status" :class="{ active: isMyTurn }">
        {{ isMyTurn ? 'Your turn' : 'Waiting' }}
      </div>
    </div>

    <div class="score-display">
      <div class="score-label">Your Score</div>
      <div class="score-value">{{ playerScore }}</div>
    </div>

    <div class="rack-container">
      <div class="rack-label">Your Letters:</div>
      <div class="mobile-rack">
        <div v-for="(letter, index) in rack" :key="index" class="rack-tile">
          <div class="letter">{{ letter.toUpperCase() }}</div>
          <div class="points">{{ getLetterValue(letter) }}</div>
        </div>
      </div>
      <div v-if="rack.length === 0" class="empty-rack">No letters yet</div>
    </div>

    <div class="info">
      <p>Keep this screen open during the game</p>
      <p>Updates when tiles change</p>
      <button @click="refresh" class="refresh-button">Refresh</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MobileRackView',
  data() {
    return {
      gameId: '',
      playerId: '',
      rack: [],
      playerScore: 0,
      currentPlayer: 1,
      updateInterval: null,
    };
  },
  computed: {
    playerName() {
      return this.playerId === '1' ? 'Player 1' : 'Player 2';
    },
    isMyTurn() {
      return String(this.currentPlayer) === this.playerId;
    },
  },
  mounted() {
    // Get game ID and player ID from URL
    const urlParams = new URLSearchParams(this.$route.query);
    this.gameId = urlParams.get('game') || 'default';
    this.playerId = urlParams.get('player') || '1';

    // Load initial data
    this.loadGameData();

    // Poll for updates every 1 second
    this.updateInterval = setInterval(() => {
      this.loadGameData();
    }, 1000);
  },
  beforeUnmount() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  },
  methods: {
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
    loadGameData() {
      try {
        const gameData = localStorage.getItem(`oxyphenbutazone_game_${this.gameId}`);
        if (gameData) {
          const data = JSON.parse(gameData);
          if (this.playerId === '1') {
            this.rack = data.player1Rack || [];
            this.playerScore = data.player1Score || 0;
          } else {
            this.rack = data.player2Rack || [];
            this.playerScore = data.player2Score || 0;
          }
          this.currentPlayer = data.currentPlayer || 1;
        }
      } catch (error) {
        console.error('Error loading game data:', error);
      }
    },
    refresh() {
      this.loadGameData();
    },
  },
};
</script>

<style scoped>
.mobile-rack-view {
  min-height: 100vh;
  background: var(--surface-0);
  color: var(--ink);
  padding: 20px;
  font-family: Avenir, Helvetica, Arial, sans-serif;
}

.header {
  text-align: center;
  color: var(--ink);
  margin-bottom: 20px;
}

.header h1 {
  margin: 0 0 10px 0;
  font-size: 2rem;
}

.status {
  display: inline-block;
  padding: 8px 20px;
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink-muted);
}

.status.active {
  background: var(--accent-soft);
  border-color: var(--accent-edge);
  color: var(--ink);
  /* Steady while active: the words already say whose turn it is. No loop. */
}

.score-display {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  text-align: center;
}

.score-label {
  font-size: 0.9rem;
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 5px;
}

.score-value {
  font-size: 3rem;
  font-weight: bold;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.rack-container {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.rack-label {
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--ink);
  margin-bottom: 15px;
  text-align: center;
}

.mobile-rack {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

/* Porcelain tiles in both themes — never the khaki imitation (R1: the
   letter already names the tile, so the face stays quiet). */
.rack-tile {
  width: 90px;
  height: 90px;
  background: linear-gradient(135deg, var(--tile-face-hi, #fff), var(--tile-face-lo, #e9e6da));
  border: 1px solid var(--tile-edge, #333);
  box-shadow:
    inset 0 1px 0 var(--cell-glint, transparent),
    var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.2));
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.letter {
  font-size: 2.5rem;
  font-weight: bold;
  text-transform: uppercase;
  color: var(--tile-ink, #333);
}

.points {
  position: absolute;
  bottom: 5px;
  right: 8px;
  font-size: 1rem;
  font-weight: bold;
  color: var(--tile-sub, #666);
  font-variant-numeric: tabular-nums;
}

.empty-rack {
  text-align: center;
  padding: 30px;
  color: var(--ink-faint);
  font-size: 1.1rem;
}

.info {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.info p {
  margin: 10px 0;
  font-size: 0.95rem;
  color: var(--ink-muted);
}

.refresh-button {
  margin-top: 15px;
  padding: 12px 30px;
  font-size: 1.1rem;
  font-weight: 700;
  background: var(--primary);
  color: var(--on-primary);
  border: 1px solid var(--primary);
  border-radius: 12px;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.refresh-button:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.refresh-button:active {
  transform: translateY(0) scale(0.97);
  transition-duration: 60ms;
}
</style>
