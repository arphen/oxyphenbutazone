<template>
  <div v-if="isVisible" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Score History</h2>
        <button class="close-button" @click="closeModal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="table-container">
          <table class="score-table">
            <thead>
              <tr>
                <th class="turn-col">Turn</th>
                <th class="player-col" :class="{ active: activePlayer === 1 }">Player 1</th>
                <th class="score-col">Score</th>
                <th class="player-col" :class="{ active: activePlayer === 2 }">Player 2</th>
                <th class="score-col">Score</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="turn in maxTurns" :key="turn" class="data-row">
                <td class="turn-cell">{{ turn }}</td>
                
                <!-- Player 1 -->
                <td class="player-cell" :class="{ active: activePlayer === 1 }">
                  <div v-if="player1History[turn - 1]">
                    <!-- Word Play -->
                    <div v-if="player1History[turn - 1].action === 'play' || !player1History[turn - 1].action">
                      <div class="words-list">
                        <span v-for="(word, idx) in player1History[turn - 1].words" :key="idx" class="word-item">
                          {{ word.word }}
                        </span>
                      </div>
                      <div class="word-details">
                        <span v-for="(word, idx) in player1History[turn - 1].words" :key="idx" class="word-score">
                          {{ word.word }}:{{ word.score }}
                        </span>
                        <span v-if="player1History[turn - 1].bingoBonus" class="bingo-text">+BINGO</span>
                      </div>
                    </div>
                    <!-- Exchange -->
                    <div v-else-if="player1History[turn - 1].action === 'exchange'" class="action-text">
                      <span class="action-icon">🔄</span> Exchanged {{ player1History[turn - 1].count }} tiles
                    </div>
                    <!-- Pass -->
                    <div v-else-if="player1History[turn - 1].action === 'pass'" class="action-text">
                      <span class="action-icon">⏭️</span> Passed turn
                    </div>
                    <!-- Invalid Word -->
                    <div v-else-if="player1History[turn - 1].action === 'invalid'" class="action-text invalid">
                      <span class="action-icon">❌</span> Invalid word(s):
                      <span v-for="(word, idx) in player1History[turn - 1].words" :key="idx" class="invalid-word">
                        {{ word.word }}
                      </span>
                    </div>
                  </div>
                  <span v-else class="empty-cell">—</span>
                </td>
                <td class="score-cell" :class="{ active: activePlayer === 1 }">
                  <strong v-if="player1History[turn - 1]">{{ player1History[turn - 1].totalScore }}</strong>
                  <span v-else>—</span>
                </td>
                
                <!-- Player 2 -->
                <td class="player-cell" :class="{ active: activePlayer === 2 }">
                  <div v-if="player2History[turn - 1]">
                    <!-- Word Play -->
                    <div v-if="player2History[turn - 1].action === 'play' || !player2History[turn - 1].action">
                      <div class="words-list">
                        <span v-for="(word, idx) in player2History[turn - 1].words" :key="idx" class="word-item">
                          {{ word.word }}
                        </span>
                      </div>
                      <div class="word-details">
                        <span v-for="(word, idx) in player2History[turn - 1].words" :key="idx" class="word-score">
                          {{ word.word }}:{{ word.score }}
                        </span>
                        <span v-if="player2History[turn - 1].bingoBonus" class="bingo-text">+BINGO</span>
                      </div>
                    </div>
                    <!-- Exchange -->
                    <div v-else-if="player2History[turn - 1].action === 'exchange'" class="action-text">
                      <span class="action-icon">🔄</span> Exchanged {{ player2History[turn - 1].count }} tiles
                    </div>
                    <!-- Pass -->
                    <div v-else-if="player2History[turn - 1].action === 'pass'" class="action-text">
                      <span class="action-icon">⏭️</span> Passed turn
                    </div>
                    <!-- Invalid Word -->
                    <div v-else-if="player2History[turn - 1].action === 'invalid'" class="action-text invalid">
                      <span class="action-icon">❌</span> Invalid word(s):
                      <span v-for="(word, idx) in player2History[turn - 1].words" :key="idx" class="invalid-word">
                        {{ word.word }}
                      </span>
                    </div>
                  </div>
                  <span v-else class="empty-cell">—</span>
                </td>
                <td class="score-cell" :class="{ active: activePlayer === 2 }">
                  <strong v-if="player2History[turn - 1]">{{ player2History[turn - 1].totalScore }}</strong>
                  <span v-else>—</span>
                </td>
              </tr>
              
              <!-- Total Row -->
              <tr class="total-row">
                <td class="turn-cell"><strong>TOTAL</strong></td>
                <td class="player-cell" :class="{ active: activePlayer === 1 }"></td>
                <td class="score-cell total-score-cell" :class="{ active: activePlayer === 1 }">
                  <strong>{{ player1TotalScore }}</strong>
                </td>
                <td class="player-cell" :class="{ active: activePlayer === 2 }"></td>
                <td class="score-cell total-score-cell" :class="{ active: activePlayer === 2 }">
                  <strong>{{ player2TotalScore }}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ScoreHistoryModal',
  props: {
    isVisible: {
      type: Boolean,
      required: true,
    },
    player1History: {
      type: Array,
      required: true,
    },
    player2History: {
      type: Array,
      required: true,
    },
    player1TotalScore: {
      type: Number,
      required: true,
    },
    player2TotalScore: {
      type: Number,
      required: true,
    },
    activePlayer: {
      type: Number,
      default: null,
    },
  },
  computed: {
    maxTurns() {
      return Math.max(this.player1History.length, this.player2History.length, 1);
    },
  },
  methods: {
    closeModal() {
      this.$emit('close');
    },
  },
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 95%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 15px 20px;
  border-bottom: 2px solid #217346;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #217346;
  color: white;
  border-radius: 8px 8px 0 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 1.8rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.modal-body {
  padding: 0;
  overflow: auto;
  flex: 1;
  background: #f3f3f3;
}

.table-container {
  overflow-x: auto;
  background: white;
}

.score-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 0.9rem;
  background: white;
}

.score-table thead {
  background: #217346;
  color: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

.score-table th {
  padding: 12px 8px;
  text-align: center;
  font-weight: 600;
  border: 1px solid #d0d0d0;
  font-size: 0.95rem;
}

.score-table th.active {
  background: #2d9b5f;
}

.turn-col {
  width: 60px;
  background: #2d9b5f;
}

.player-col {
  min-width: 200px;
}

.score-col {
  width: 80px;
}

.score-table td {
  padding: 8px;
  border: 1px solid #d0d0d0;
  text-align: center;
  background: white;
}

.data-row:nth-child(even) td {
  background: #f9f9f9;
}

.data-row:hover td {
  background: #e8f5e9;
}

.turn-cell {
  font-weight: 600;
  color: #333;
  background: #e8e8e8 !important;
}

.player-cell {
  text-align: left;
  padding: 10px 12px;
}

.player-cell.active {
  background: #e3f2fd !important;
  border-left: 3px solid #2196F3;
}

.score-cell {
  font-weight: 600;
  font-size: 1rem;
  color: #333;
}

.score-cell.active {
  background: #e3f2fd !important;
}

.words-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}

.word-item {
  font-weight: 600;
  color: #1976D2;
  font-size: 0.95rem;
}

.word-details {
  font-size: 0.8rem;
  color: #666;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.word-score {
  background: #e8e8e8;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.bingo-text {
  background: #ff9800;
  color: white;
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: bold;
  font-size: 0.75rem;
}

.action-text {
  font-style: italic;
  color: #555;
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-text.invalid {
  color: #d32f2f;
  font-style: normal;
  font-weight: 500;
}

.invalid-word {
  font-family: 'Courier New', monospace;
  background: #ffebee;
  padding: 2px 5px;
  border-radius: 3px;
  margin-left: 4px;
}

.action-icon {
  font-size: 1.1rem;
}

.empty-cell {
  color: #ccc;
  font-size: 1.2rem;
}

.total-row {
  background: #217346 !important;
  color: white;
  font-weight: bold;
}

.total-row td {
  background: #217346 !important;
  color: white;
  border-color: #1a5c38 !important;
  padding: 14px 8px;
  font-size: 1.1rem;
}

.total-score-cell {
  font-size: 1.3rem !important;
}

.total-row .score-cell.active {
  background: #2d9b5f !important;
}
</style>
