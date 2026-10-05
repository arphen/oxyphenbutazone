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
                    <div
                      v-if="
                        player1History[turn - 1].action === 'play' ||
                        !player1History[turn - 1].action
                      "
                    >
                      <div class="words-list">
                        <span
                          v-for="(word, idx) in player1History[turn - 1].words"
                          :key="idx"
                          class="word-item"
                        >
                          {{ word.word }}
                        </span>
                      </div>
                      <div class="word-details">
                        <span
                          v-for="(word, idx) in player1History[turn - 1].words"
                          :key="idx"
                          class="word-score"
                        >
                          {{ word.word }}:{{ word.score }}
                        </span>
                        <span v-if="player1History[turn - 1].bingoBonus" class="bingo-text"
                          >+BINGO</span
                        >
                      </div>
                    </div>
                    <!-- Exchange -->
                    <div
                      v-else-if="player1History[turn - 1].action === 'exchange'"
                      class="action-text"
                    >
                      Exchanged {{ player1History[turn - 1].count }} tiles
                    </div>
                    <!-- Pass -->
                    <div v-else-if="player1History[turn - 1].action === 'pass'" class="action-text">
                      Passed turn
                    </div>
                    <!-- Invalid Word -->
                    <div
                      v-else-if="player1History[turn - 1].action === 'invalid'"
                      class="action-text invalid"
                    >
                      Invalid word(s):
                      <span
                        v-for="(word, idx) in player1History[turn - 1].words"
                        :key="idx"
                        class="invalid-word"
                      >
                        {{ word.word }}
                      </span>
                    </div>
                  </div>
                  <span v-else class="empty-cell">—</span>
                </td>
                <td class="score-cell" :class="{ active: activePlayer === 1 }">
                  <strong v-if="player1History[turn - 1]">{{
                    player1History[turn - 1].totalScore
                  }}</strong>
                  <span v-else>—</span>
                </td>

                <!-- Player 2 -->
                <td class="player-cell" :class="{ active: activePlayer === 2 }">
                  <div v-if="player2History[turn - 1]">
                    <!-- Word Play -->
                    <div
                      v-if="
                        player2History[turn - 1].action === 'play' ||
                        !player2History[turn - 1].action
                      "
                    >
                      <div class="words-list">
                        <span
                          v-for="(word, idx) in player2History[turn - 1].words"
                          :key="idx"
                          class="word-item"
                        >
                          {{ word.word }}
                        </span>
                      </div>
                      <div class="word-details">
                        <span
                          v-for="(word, idx) in player2History[turn - 1].words"
                          :key="idx"
                          class="word-score"
                        >
                          {{ word.word }}:{{ word.score }}
                        </span>
                        <span v-if="player2History[turn - 1].bingoBonus" class="bingo-text"
                          >+BINGO</span
                        >
                      </div>
                    </div>
                    <!-- Exchange -->
                    <div
                      v-else-if="player2History[turn - 1].action === 'exchange'"
                      class="action-text"
                    >
                      Exchanged {{ player2History[turn - 1].count }} tiles
                    </div>
                    <!-- Pass -->
                    <div v-else-if="player2History[turn - 1].action === 'pass'" class="action-text">
                      Passed turn
                    </div>
                    <!-- Invalid Word -->
                    <div
                      v-else-if="player2History[turn - 1].action === 'invalid'"
                      class="action-text invalid"
                    >
                      Invalid word(s):
                      <span
                        v-for="(word, idx) in player2History[turn - 1].words"
                        :key="idx"
                        class="invalid-word"
                      >
                        {{ word.word }}
                      </span>
                    </div>
                  </div>
                  <span v-else class="empty-cell">—</span>
                </td>
                <td class="score-cell" :class="{ active: activePlayer === 2 }">
                  <strong v-if="player2History[turn - 1]">{{
                    player2History[turn - 1].totalScore
                  }}</strong>
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
  background: var(--surface-3);
  border: 1px solid var(--surface-edge);
  border-radius: 12px;
  width: 95%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg, 0 10px 40px rgba(0, 0, 0, 0.3));
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
  border-bottom: 1px solid var(--surface-edge);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--surface-2);
  color: var(--ink);
  border-radius: 12px 12px 0 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: var(--ink-muted);
  font-size: 1.8rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-button:hover {
  color: var(--ink);
}

.modal-body {
  padding: 0;
  overflow: auto;
  flex: 1;
  background: var(--surface-1);
}

.table-container {
  overflow-x: auto;
  background: var(--surface-1);
}

.score-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  background: var(--surface-1);
  font-variant-numeric: tabular-nums;
}

.score-table thead {
  background: var(--surface-2);
  color: var(--ink);
  position: sticky;
  top: 0;
  z-index: 10;
}

.score-table th {
  padding: 12px 8px;
  text-align: center;
  font-weight: 600;
  border: 1px solid var(--surface-edge);
  font-size: 0.95rem;
}

.score-table th.active {
  background: var(--accent-soft);
}

.turn-col {
  width: 60px;
}

.player-col {
  min-width: 200px;
}

.score-col {
  width: 80px;
}

.score-table td {
  padding: 8px;
  border: 1px solid var(--surface-edge);
  text-align: center;
  background: var(--surface-1);
  color: var(--ink);
}

.data-row:hover td {
  background: var(--surface-2);
}

.turn-cell {
  font-weight: 600;
  color: var(--ink-muted);
}

.player-cell {
  text-align: left;
  padding: 10px 12px;
}

.player-cell.active {
  border-left: 3px solid var(--accent-edge);
  background: var(--accent-soft);
}

.score-cell {
  font-weight: 600;
  font-size: 1rem;
  color: var(--ink);
}

.score-cell.active {
  background: var(--accent-soft);
}

.words-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}

.word-item {
  font-weight: 600;
  color: var(--ink);
  font-size: 0.95rem;
  text-transform: uppercase;
}

.word-details {
  font-size: 0.8rem;
  color: var(--ink-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.word-score {
  background: var(--surface-3);
  border: 1px solid var(--surface-edge);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--mono, ui-monospace, monospace);
}

.bingo-text {
  background: var(--warn-soft);
  color: var(--warn);
  border: 1px solid var(--warn-edge);
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: bold;
  font-size: 0.75rem;
}

.action-text {
  font-style: italic;
  color: var(--ink-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-text.invalid {
  color: var(--danger);
  font-style: normal;
  font-weight: 500;
}

.invalid-word {
  font-family: var(--mono, ui-monospace, monospace);
  background: var(--danger-soft);
  border: 1px solid var(--danger-edge);
  padding: 2px 5px;
  border-radius: 3px;
  margin-left: 4px;
  text-transform: uppercase;
}

.empty-cell {
  color: var(--ink-faint);
  font-size: 1.2rem;
}

.total-row {
  font-weight: bold;
}

.total-row td {
  background: var(--surface-2) !important;
  color: var(--ink);
  border-color: var(--surface-edge) !important;
  padding: 14px 8px;
  font-size: 1.1rem;
}

.total-score-cell {
  font-size: 1.3rem !important;
}

/* Narrow screens: the 5-column table keeps its columns and scrolls
   horizontally inside .table-container (overflow-x: auto already set);
   just tighten padding/type so more fits. */
@media (max-width: 640px) {
  .modal-header h2 {
    font-size: 1.05rem;
  }
  .score-table {
    font-size: 0.8rem;
    min-width: 520px;
  }
  .score-table th,
  .score-table td {
    padding: 6px 4px;
  }
  .player-col {
    min-width: 140px;
  }
}
</style>
