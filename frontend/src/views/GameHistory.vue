<template>
  <div class="game-history-view">
    <div class="history-container">
      <div class="history-header">
        <button @click="goHome" class="back-button">← Back</button>
        <h1>Game History</h1>
        <button @click="clearAllGames" class="clear-button" v-if="games.length > 0">
          Clear All
        </button>
      </div>

      <div class="games-list" v-if="games.length > 0">
        <div
          v-for="game in games"
          :key="game.id"
          class="game-card"
          :class="{ 'in-progress': game.status === 'in-progress' }"
          @click="viewGame(game.id)"
        >
          <div class="game-header">
            <div class="game-status">
              <span class="status-badge" :class="game.status">
                {{ game.status === 'completed' ? '✓' : '▶' }}
                {{ game.status === 'completed' ? 'Completed' : 'In Progress' }}
              </span>
            </div>
            <div class="game-date">
              {{ formatDate(game.startedAt) }}
            </div>
          </div>

          <div class="game-body">
            <div class="players-scores">
              <div class="player-score">
                <div class="player-name">{{ game.metadata.player1Name || 'Player 1' }}</div>
                <div class="score">
                  {{ game.metadata.finalScore1 || game.finalState?.player1?.score || 0 }}
                </div>
              </div>
              <div class="vs">vs</div>
              <div class="player-score">
                <div class="player-name">{{ game.metadata.player2Name || 'Player 2' }}</div>
                <div class="score">
                  {{ game.metadata.finalScore2 || game.finalState?.player2?.score || 0 }}
                </div>
              </div>
            </div>

            <div class="game-stats">
              <div class="stat">
                <span class="stat-icon">•</span>
                <span class="stat-value">{{ game.moves.length }} moves</span>
              </div>
              <div class="stat">
                <span class="stat-icon">•</span>
                <span class="stat-value">{{ formatDuration(game) }}</span>
              </div>
              <div class="stat" v-if="game.metadata.winner">
                <span class="stat-icon">•</span>
                <span class="stat-value">{{ game.metadata.winner }}</span>
              </div>
            </div>
          </div>

          <div class="game-actions">
            <button @click.stop="viewGame(game.id)" class="action-btn primary">Analyze</button>
            <button
              v-if="game.status === 'in-progress'"
              @click.stop="resumeGame(game.id)"
              class="action-btn secondary"
            >
              Resume
            </button>
            <button @click.stop="deleteGame(game.id)" class="action-btn danger">Delete</button>
          </div>
        </div>
      </div>

      <div class="empty-state" v-else>
        <div class="empty-icon">0</div>
        <h2>No games recorded</h2>
        <p>Games appear here after the first move.</p>
        <button @click="goHome" class="start-game-button">Start a game</button>
      </div>
    </div>
  </div>
</template>

<script>
import { useGamePersistence } from '../composables/useGamePersistence.js';

export default {
  name: 'GameHistory',
  data() {
    return {
      games: [],
      gamePersistence: null,
    };
  },
  mounted() {
    this.gamePersistence = useGamePersistence();
    this.loadGames();
  },
  methods: {
    loadGames() {
      this.games = this.gamePersistence.getAllGames();
    },
    goHome() {
      this.$router.push('/');
    },
    viewGame(gameId) {
      this.$router.push(`/replay/${gameId}`);
    },
    resumeGame(gameId) {
      // Resume the game - this would need backend integration
      // For now, just navigate to the game view
      this.$router.push('/game');
    },
    deleteGame(gameId) {
      if (confirm('Are you sure you want to delete this game?')) {
        this.gamePersistence.deleteGame(gameId);
        this.loadGames();
      }
    },
    clearAllGames() {
      if (this.gamePersistence.clearAllGames()) {
        this.loadGames();
      }
    },
    formatDate(dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    },
    formatDuration(game) {
      const start = new Date(game.startedAt);
      const end = game.completedAt ? new Date(game.completedAt) : new Date(game.lastMoveAt);
      const diffMs = end - start;
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 60) return `${diffMins}m`;

      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    },
  },
};
</script>

<style scoped>
/* Afterglow history: flat page, matte cards, token-only state. No glass on
   cards or rows; interaction spends accent, validation spends success/danger. */
.game-history-view {
  /* why: the page is flat surface-0; depth lives on the cards, not the ground. */
  min-height: 100vh;
  background: var(--surface-0);
  padding: 20px;
  color: var(--ink);
}

.history-container {
  max-width: 1200px;
  margin: 0 auto;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
  gap: 20px;
}

.history-header h1 {
  flex: 1;
  text-align: center;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0;
}

.back-button,
.clear-button {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink);
  padding: 10px 20px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 600;
  /* why: motion spends transform/border/background only, ≤240ms; press is 60ms. */
  transition:
    transform var(--dur-settle, 240ms) var(--ease-out),
    border-color var(--dur-quick, 160ms) var(--ease-out),
    background-color var(--dur-quick, 160ms) var(--ease-out);
}

.back-button:hover,
.clear-button:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.back-button:active,
.clear-button:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.clear-button {
  /* why: destructive action spends danger only, never a hand-picked red. */
  background: var(--danger-soft);
  border-color: var(--danger-edge);
  color: var(--danger);
}

.clear-button:hover {
  border-color: var(--danger);
}

.games-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.game-card {
  /* why: matte card — surface-1 + edge + glint; blur is reserved for overlays. */
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  border-radius: var(--radius-md);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  padding: 20px;
  cursor: pointer;
  transition:
    transform var(--dur-settle, 240ms) var(--ease-out),
    border-color var(--dur-quick, 160ms) var(--ease-out),
    background-color var(--dur-quick, 160ms) var(--ease-out);
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.game-card:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.game-card.in-progress {
  /* why: in-progress is attention/selection, so it spends accent, not green. */
  border-color: var(--accent-edge);
  background: color-mix(in oklab, var(--accent) 10%, var(--surface-1));
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: var(--radius-pill);
}

.status-badge.completed {
  /* why: completed is validation, so it spends success; validation wins. */
  background: var(--success-soft);
  color: var(--success);
  border: 1px solid var(--success-edge);
}

.status-badge.in-progress {
  /* why: in-progress is selection/attention, so it spends accent. */
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--accent-edge);
}

.game-date {
  font-size: 0.9rem;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
}

.game-body {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.players-scores {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.player-score {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.player-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.score {
  font-size: 2rem;
  font-weight: 700;
  color: var(--ink);
  /* why: tabular figures keep scores aligned instead of jittering. */
  font-variant-numeric: tabular-nums;
}

.vs {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink-faint);
  text-transform: uppercase;
}

.game-stats {
  display: flex;
  gap: 15px;
  padding: 10px 0;
  border-top: 1px solid var(--surface-edge);
}

.stat {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.85rem;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
}

.stat-icon {
  /* why: decorative marker only, so it keeps faint ink and spends no hue. */
  font-size: 1rem;
  color: var(--ink-faint);
}

.game-actions {
  display: flex;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--surface-edge);
}

.action-btn {
  flex: 1;
  padding: 10px 15px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  border-radius: var(--radius-sm);
  /* why: keyboard focus keeps the global 2px ring; it is never removed here. */
  transition:
    transform var(--dur-quick, 160ms) var(--ease-out),
    border-color var(--dur-quick, 160ms) var(--ease-out),
    background-color var(--dur-quick, 160ms) var(--ease-out);
}

.action-btn:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.action-btn.primary {
  /* why: the default row action spends accent, the interaction token. */
  background: var(--accent-soft);
  border-color: var(--accent-edge);
  color: var(--accent);
}

.action-btn.primary:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.action-btn.secondary {
  /* why: secondary action claims no state, so it stays neutral surface + ink. */
  background: var(--surface-2);
  border-color: var(--surface-edge);
  color: var(--ink);
}

.action-btn.secondary:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.action-btn.danger {
  /* why: destructive action spends danger only. */
  background: var(--danger-soft);
  border-color: var(--danger-edge);
  color: var(--danger);
  flex: 0 0 auto;
  padding: 10px 15px;
}

.action-btn.danger:hover {
  border-color: var(--danger);
  transform: translateY(-1px);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  border-radius: var(--radius-md);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  margin-top: 40px;
}

.empty-icon {
  /* why: honest count (0 games) in faint ink instead of a playful glyph. */
  font-size: 4rem;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 20px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.empty-state h2 {
  font-size: 1.8rem;
  margin-bottom: 10px;
  color: var(--ink);
}

.empty-state p {
  font-size: 1.1rem;
  color: var(--ink-muted);
  margin-bottom: 30px;
}

.start-game-button {
  background: var(--primary);
  border: 1px solid var(--primary);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--on-primary);
  padding: 15px 30px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform var(--dur-quick, 160ms) var(--ease-out),
    border-color var(--dur-quick, 160ms) var(--ease-out),
    background-color var(--dur-quick, 160ms) var(--ease-out);
}

.start-game-button:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
  transform: translateY(-1px);
}

.start-game-button:active {
  background: var(--primary-pressed);
  border-color: var(--primary-pressed);
  transform: scale(0.97);
  transition-duration: 60ms;
}

@media (max-width: 768px) {
  .games-list {
    grid-template-columns: 1fr;
  }

  .history-header h1 {
    font-size: 1.5rem;
  }
}
</style>
