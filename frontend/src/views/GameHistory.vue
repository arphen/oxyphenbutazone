<template>
  <div class="game-history-view">
    <div class="history-container">
      <div class="history-header">
        <button @click="goHome" class="back-button">
          ← Back
        </button>
        <h1>Game History</h1>
        <button @click="clearAllGames" class="clear-button" v-if="games.length > 0">
          🗑️ Clear All
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
                <div class="score">{{ game.metadata.finalScore1 || game.finalState?.player1?.score || 0 }}</div>
              </div>
              <div class="vs">vs</div>
              <div class="player-score">
                <div class="player-name">{{ game.metadata.player2Name || 'Player 2' }}</div>
                <div class="score">{{ game.metadata.finalScore2 || game.finalState?.player2?.score || 0 }}</div>
              </div>
            </div>

            <div class="game-stats">
              <div class="stat">
                <span class="stat-icon">📊</span>
                <span class="stat-value">{{ game.moves.length }} moves</span>
              </div>
              <div class="stat">
                <span class="stat-icon">⏱️</span>
                <span class="stat-value">{{ formatDuration(game) }}</span>
              </div>
              <div class="stat" v-if="game.metadata.winner">
                <span class="stat-icon">🏆</span>
                <span class="stat-value">{{ game.metadata.winner }}</span>
              </div>
            </div>
          </div>

          <div class="game-actions">
            <button @click.stop="viewGame(game.id)" class="action-btn primary">
              🔍 Analyze
            </button>
            <button 
              v-if="game.status === 'in-progress'" 
              @click.stop="resumeGame(game.id)" 
              class="action-btn secondary"
            >
              ▶️ Resume
            </button>
            <button @click.stop="deleteGame(game.id)" class="action-btn danger">
              🗑️
            </button>
          </div>
        </div>
      </div>

      <div class="empty-state" v-else>
        <div class="empty-icon">🎲</div>
        <h2>No Games Yet</h2>
        <p>Start playing to see your game history here!</p>
        <button @click="goHome" class="start-game-button">
          Start a New Game
        </button>
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
      gamePersistence: null
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
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
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
    }
  }
};
</script>

<style scoped>
.game-history-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 20px;
  color: #e4e4e7;
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
  font-size: 2rem;
  font-weight: 700;
  color: #e4e4e7;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.back-button,
.clear-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e4e4e7;
  padding: 10px 20px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  font-weight: 600;
}

.back-button:hover,
.clear-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.clear-button {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
}

.clear-button:hover {
  background: rgba(239, 68, 68, 0.3);
}

.games-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.game-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.game-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}

.game-card.in-progress {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(59, 130, 246, 0.05);
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
  border-radius: 12px;
}

.status-badge.completed {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.status-badge.in-progress {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.game-date {
  font-size: 0.9rem;
  color: #a1a1aa;
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
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.score {
  font-size: 2rem;
  font-weight: 700;
  color: #e4e4e7;
}

.vs {
  font-size: 1rem;
  font-weight: 600;
  color: #71717a;
  text-transform: uppercase;
}

.game-stats {
  display: flex;
  gap: 15px;
  padding: 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.stat {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.85rem;
  color: #a1a1aa;
}

.stat-icon {
  font-size: 1rem;
}

.game-actions {
  display: flex;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.action-btn {
  flex: 1;
  padding: 10px 15px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid;
}

.action-btn.primary {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
  color: #93c5fd;
}

.action-btn.primary:hover {
  background: rgba(59, 130, 246, 0.3);
}

.action-btn.secondary {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.4);
  color: #86efac;
}

.action-btn.secondary:hover {
  background: rgba(34, 197, 94, 0.3);
}

.action-btn.danger {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  flex: 0 0 auto;
  padding: 10px;
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.3);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 2px dashed rgba(255, 255, 255, 0.2);
  margin-top: 40px;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-state h2 {
  font-size: 1.8rem;
  margin-bottom: 10px;
  color: #e4e4e7;
}

.empty-state p {
  font-size: 1.1rem;
  color: #a1a1aa;
  margin-bottom: 30px;
}

.start-game-button {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  color: #93c5fd;
  padding: 15px 30px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.start-game-button:hover {
  background: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
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
