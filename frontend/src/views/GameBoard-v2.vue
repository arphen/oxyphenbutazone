<template>
  <div id="app">
    <!-- Mobile View -->
    <MobileRackView v-if="isMobileView" />

    <!-- Main Game View -->
    <template v-else>
      <div class="desktop-layout">
        <!-- Board Section -->
        <div class="board-section">
          <!-- Always-visible compact score strip: every seat, turn state,
               last-move delta, tiles left. No modal needed. -->
          <div class="score-topbar" aria-label="Scores" aria-live="polite">
            <div class="top-chips">
              <span
                v-for="n in playerCount"
                :key="n"
                class="top-chip"
                :class="{ active: gameState?.[`player${n}`]?.isCurrentPlayer }"
                :aria-current="gameState?.[`player${n}`]?.isCurrentPlayer ? 'true' : undefined"
                :title="`Player ${n}${gameState?.[`player${n}`]?.isCurrentPlayer ? ' — current turn' : ''}`"
              >
                <span class="top-dot" :class="`p${n}`" aria-hidden="true"></span>
                <span class="top-name">P{{ n }}</span>
                <span class="top-score">{{ gameState?.[`player${n}`]?.score || 0 }}</span>
                <span v-if="lastDeltaByPlayer[n]" class="top-delta"
                  >+{{ lastDeltaByPlayer[n] }}</span
                >
                <span
                  v-if="gameState?.[`player${n}`]?.isCurrentPlayer"
                  class="top-turn"
                  aria-hidden="true"
                  >●</span
                >
              </span>
            </div>
            <span class="tiles-pill" :class="getTilesRemainingClass()" title="Tiles remaining">
              Tiles {{ tilesRemaining }}
            </span>
          </div>
          <Board
            :board="gameState?.board || []"
            :language="gameState?.language"
            :cues="boardCues"
            :freshKeys="freshKeys"
            @cell-click="handleCellClick"
          />
        </div>

        <!-- Sidebar -->
        <div class="sidebar">
          <!-- Header Controls -->
          <div class="sidebar-header">
            <button @click="goHome" class="icon-button" title="Back to Menu">Home</button>
            <button @click="toggleQR" class="icon-button" title="Toggle QR Codes">QR</button>
            <DictionaryChooser
              :selectedDictionaries="selectedDictionaries"
              :installed="installedLists"
              :language="gameState?.language"
              @update="handleDictionaryUpdate"
            />
            <button @click="restartGame" class="icon-button" title="Restart Game">Restart</button>
            <button @click="testSound" class="icon-button" title="Test Sound">Sound</button>
          </div>

          <!-- Players Info -->
          <div class="players-container">
            <div
              v-for="playerNum in playerCount"
              :key="playerNum"
              class="player-card"
              :class="{
                active: gameState?.[`player${playerNum}`]?.isCurrentPlayer,
                [`player-${playerNum}`]: true,
              }"
            >
              <div class="player-badge">
                <span class="player-seat">P{{ playerNum }}</span>
              </div>
              <div class="player-info">
                <div class="player-name">P{{ playerNum }}</div>
                <div class="player-score">{{ gameState?.[`player${playerNum}`]?.score || 0 }}</div>
              </div>
            </div>
          </div>

          <!-- Tiles Remaining Counter -->
          <div class="tiles-remaining" :class="getTilesRemainingClass()">
            <div class="tiles-info">
              <div class="tiles-label">Tiles Left</div>
              <div class="tiles-count">{{ tilesRemaining }}</div>
            </div>
          </div>

          <!-- Game History Table -->
          <div class="history-section">
            <h3>Game History</h3>
            <div class="history-table-wrapper">
              <table class="history-table">
                <thead>
                  <tr>
                    <th>Rnd</th>
                    <th>Player</th>
                    <th>Words</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(entry, index) in historyRows" :key="index" :class="entry.result">
                    <td>{{ entry.round }}</td>
                    <td>P{{ entry.player }}</td>
                    <td class="words-cell">
                      <span v-if="entry.action === 'pass'"> Passed turn </span>
                      <span v-else-if="entry.action === 'exchange'">
                        Exchanged {{ entry.tilesExchanged }}
                      </span>
                      <span v-else-if="entry.action === 'invalid'">
                        <span v-for="(wordObj, idx) in entry.words" :key="idx">
                          <span class="word-with-definition" :title="wordObj.definition">
                            × {{ wordObj.word }}
                          </span>
                          <span v-if="idx < entry.words.length - 1">, </span>
                        </span>
                      </span>
                      <span v-else>
                        <span v-for="(wordObj, idx) in entry.words" :key="idx">
                          <span
                            class="word-with-definition"
                            :class="wordCueClass(entry, idx)"
                            :style="wordCueStyle(entry, idx)"
                            :data-pole="wordCuePole(entry, idx)"
                            :title="wordObj.definition"
                          >
                            {{ wordObj.word }}
                          </span>
                          <span v-if="idx < entry.words.length - 1">, </span>
                        </span>
                      </span>
                    </td>
                    <td class="score-cell">
                      <span
                        v-if="
                          entry.action !== 'exchange' &&
                          entry.action !== 'invalid' &&
                          entry.action !== 'pass'
                        "
                        >+{{ entry.totalScore }}</span
                      >
                      <span v-else>—</span>
                    </td>
                  </tr>
                  <tr v-if="historyRows.length === 0">
                    <td colspan="4" class="no-history">No moves yet</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Message Box -->
          <div class="message-section" v-if="gameState?.message">
            <div class="message-box" :class="gameState?.messageType">
              {{ gameState.message }}
            </div>
          </div>

          <!-- Reader dials live at the bottom: the panel opens upward over
            the sidebar's own content, never past the viewport top (R19). -->
          <div class="view-section">
            <ViewPanel />
          </div>
        </div>
      </div>
    </template>

    <!-- Game Over Modal -->
    <GameOverModal
      :show="gameState?.gameOver || false"
      :winner="gameState?.winner"
      :gameState="gameState"
      :finalScore1="gameState?.finalScores?.player1 || 0"
      :finalScore2="gameState?.finalScores?.player2 || 0"
      :gameScore1="gameState?.player1.score || 0"
      :gameScore2="gameState?.player2.score || 0"
      :remaining1="gameState?.finalScores?.player1Remaining || 0"
      :remaining2="gameState?.finalScores?.player2Remaining || 0"
      @new-game="restartGame"
      @close="handleGameOverClose"
    />

    <!-- QR Modal -->
    <QRModal :show="showQR" :players="qrPlayers" :playerCount="playerCount" @close="toggleQR" />
  </div>
</template>

<script>
import Board from '../components/Board.vue';
import QRModal from '../components/QRModal.vue';
import MobileRackView from '../components/MobileRackView.vue';
import GameOverModal from '../components/GameOverModal.vue';
import DictionaryChooser from '../components/DictionaryChooser.vue';
import ViewPanel from '../components/ViewPanel.vue';
import {
  computeLibido,
  computeWordCues,
  countHelps,
  diffFresh,
} from '../composables/useWordCues.js';
import { useSoundEffects } from '../composables/useSoundEffects.js';
import { useGamePersistence } from '../composables/useGamePersistence.js';
import { debug } from '../utils/log';
import { getBackend } from '../net/api';

export default {
  name: 'GameBoard',
  components: {
    Board,
    QRModal,
    MobileRackView,
    GameOverModal,
    DictionaryChooser,
    ViewPanel,
  },
  setup() {
    const { playClickSound, testSound } = useSoundEffects();
    const gamePersistence = useGamePersistence();
    return {
      playClickSound,
      testSound,
      gamePersistence,
    };
  },
  data() {
    return {
      gameState: null,
      showQR: false,
      isMobileView: false,
      pollInterval: null,
      selectedDictionaries: { csw21: true, nwl2023: false, enable: false, slovenian: false },
      lastServerDictionaries: null,
      installedLists: null, // ids of the word lists this device has (local mode only); null = do not restrict the chooser
      playerCount: 4, // Default to 4 players, can be changed from route params
      boardSnap: null, // previous board snapshot for arrival diffing (S9.5)
      freshKeys: new Set(), // "r,c" squares that just changed; they arrive once
    };
  },
  computed: {
    qrPlayers() {
      if (!this.gameState) return [];
      return Array.from({ length: this.playerCount }, (_, i) => {
        const playerNum = i + 1;
        const player = this.gameState[`player${playerNum}`];
        return {
          name: `Player ${playerNum}`,
          score: player?.score || 0,
          isCurrentPlayer: player?.isCurrentPlayer || false,
          rack: player?.rack || [],
        };
      });
    },
    tilesRemaining() {
      if (!this.gameState) return 100;

      // Standard word-tile game has 100 tiles total
      // Calculate tiles in play: on board + in racks
      let totalRackSize = 0;
      for (let i = 1; i <= this.playerCount; i++) {
        totalRackSize += this.gameState[`player${i}`]?.rack?.length || 0;
      }

      // Count tiles on board
      let tilesOnBoard = 0;
      if (this.gameState.board) {
        for (const row of this.gameState.board) {
          for (const cell of row) {
            if (cell.letter || cell.isBlank) tilesOnBoard++;
          }
        }
      }

      const tilesInPlay = totalRackSize + tilesOnBoard;
      return Math.max(0, 100 - tilesInPlay);
    },
    lastDeltaByPlayer() {
      // Latest scoring move per seat (combinedHistory is most-recent-first).
      const deltas = {};
      for (let i = 1; i <= this.playerCount; i++) deltas[i] = 0;
      const seen = new Set();
      for (const entry of this.combinedHistory) {
        const p = entry.player;
        if (seen.has(p)) continue;
        seen.add(p);
        const s = Number(entry.totalScore);
        if (
          !['pass', 'exchange', 'invalid'].includes(entry.action) &&
          Number.isFinite(s) &&
          s > 0
        ) {
          deltas[p] = s;
        }
      }
      return deltas;
    },
    combinedHistory() {
      if (!this.gameState) return [];

      // Collect histories from all players
      const playerHistories = [];
      let maxLength = 0;

      for (let i = 1; i <= this.playerCount; i++) {
        const history = this.gameState[`player${i}`]?.history || [];
        playerHistories.push(history);
        maxLength = Math.max(maxLength, history.length);
      }

      const combined = [];

      for (let round = 0; round < maxLength; round++) {
        for (let playerNum = 1; playerNum <= this.playerCount; playerNum++) {
          const history = playerHistories[playerNum - 1];
          if (history[round]) {
            let resultClass = 'valid-row';
            if (history[round].action === 'pass') {
              resultClass = 'pass-row';
            } else if (history[round].action === 'exchange') {
              resultClass = 'exchange-row';
            } else if (history[round].action === 'invalid') {
              resultClass = 'invalid-row';
            }
            combined.push({
              ...history[round],
              player: playerNum,
              round: round + 1,
              result: resultClass,
            });
          }
        }
      }

      // Reverse to show most recent moves first
      return combined.reverse();
    },
    playerHistories() {
      return Array.from(
        { length: this.playerCount },
        (_, i) => this.gameState?.[`player${i + 1}`]?.history || []
      );
    },
    helpCounts() {
      return countHelps(this.playerHistories);
    },
    libido() {
      return computeLibido(this.helpCounts);
    },
    // Word identity cues (S3), territory corners (S6) and the charge (S7):
    // history is oldest-first for pool matching, rows stay newest-first.
    boardCues() {
      const board = this.gameState?.board || [];
      const chrono = [...this.combinedHistory].reverse();
      const cues = computeWordCues(board, chrono, this.freshKeys || new Set());
      return {
        cell: cues.cell,
        anchorKeys: new Set(cues.anchors.map(([r, c]) => `${r},${c}`)),
        ground: {
          remaining: Math.round((this.tilesRemaining / 100) * 1000) / 1000,
          libido: this.libido,
          taTop: cues.territory.aTop,
          taBottom: cues.territory.aBottom,
          tbTop: cues.territory.bTop,
          tbBottom: cues.territory.bBottom,
        },
        entryCues: cues.entryCues,
      };
    },
    historyRows() {
      const rows = this.combinedHistory;
      const n = rows.length;
      const entryCues = this.boardCues.entryCues;
      return rows.map((entry, idx) => ({ ...entry, wordCues: entryCues[n - 1 - idx] || [] }));
    },
  },
  async mounted() {
    this.loadInstalledLists();

    // Check if this is a mobile view
    const urlParams = new URLSearchParams(this.$route.query);
    this.isMobileView = urlParams.get('view') === 'mobile';

    // Get player count from route params or query
    const routePlayerCount = this.$route.params.playerCount || this.$route.query.players;
    if (routePlayerCount) {
      this.playerCount = Math.min(4, Math.max(2, parseInt(routePlayerCount)));
    }

    if (!this.isMobileView) {
      // Check if we should start a new game
      const shouldRestart = this.$route.query.newGame === 'true';

      if (shouldRestart) {
        // Initialize game with correct player count first
        debug('[GameBoard] Initializing new game with', this.playerCount, 'players');
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'restart',
            playerCount: this.playerCount,
            language: this.$route.query.language,
          }),
        });

        // Remove the newGame query param so a refresh doesn't restart again
        const query = { ...this.$route.query };
        delete query.newGame;
        this.$router.replace({ query });
      } else {
        debug('[GameBoard] Joining existing game');
      }

      // Fetch initial game state
      await this.fetchGameState();

      // Poll for updates every 500ms
      this.pollInterval = setInterval(() => {
        this.fetchGameState();
      }, 500);
    }
  },
  beforeUnmount() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  },
  methods: {
    goHome() {
      this.$router.push('/');
    },
    async fetchGameState() {
      try {
        const response = await fetch('/api/game-state');
        if (response.ok) {
          const newGameState = await response.json();

          // Initialize game persistence if this is the first state and no current game exists
          const isFirstFetch = !this.gameState;
          if (isFirstFetch && !this.gamePersistence.currentGameId.value) {
            // Check if this is a fresh game (no moves yet) OR if we need to recover mid-game
            const hasNoMoves =
              (!newGameState.player1?.history || newGameState.player1.history.length === 0) &&
              (!newGameState.player2?.history || newGameState.player2.history.length === 0);

            if (hasNoMoves && !newGameState.gameOver) {
              // Fresh game, initialize it
              this.gamePersistence.startNewGame(newGameState);
              debug(
                '[GamePersistence] Initialized new game:',
                this.gamePersistence.currentGameId.value
              );
            } else if (!hasNoMoves || newGameState.gameOver) {
              // Game in progress or completed but we don't have it tracked
              // This can happen if page was refreshed mid-game
              console.warn(
                '[GamePersistence] Game in progress detected but not tracked. Starting tracking now.'
              );
              this.gamePersistence.startNewGame(newGameState);
            }
          }

          // Detect new moves by comparing history lengths
          if (this.gameState && this.gamePersistence.currentGameId.value) {
            const oldP1Moves = this.gameState.player1?.history?.length || 0;
            const oldP2Moves = this.gameState.player2?.history?.length || 0;
            const newP1Moves = newGameState.player1?.history?.length || 0;
            const newP2Moves = newGameState.player2?.history?.length || 0;

            // Check if player 1 made a new move
            if (newP1Moves > oldP1Moves) {
              const lastMove = newGameState.player1.history[newP1Moves - 1];
              debug('[GameBoard] Player 1 made a move, recording it');
              this.recordMoveFromHistory(newGameState, '1', lastMove);
            }

            // Check if player 2 made a new move
            if (newP2Moves > oldP2Moves) {
              const lastMove = newGameState.player2.history[newP2Moves - 1];
              debug('[GameBoard] Player 2 made a move, recording it');
              this.recordMoveFromHistory(newGameState, '2', lastMove);
            }
          }

          // Check if new tiles were placed (detect isNew tiles)
          if (this.gameState && newGameState.board) {
            let hasNewTiles = false;

            for (let row = 0; row < newGameState.board.length; row++) {
              for (let col = 0; col < newGameState.board[row].length; col++) {
                const newCell = newGameState.board[row][col];
                const oldCell = this.gameState.board?.[row]?.[col];

                // If there's a letter now that wasn't there before, play sound
                if (newCell.letter && (!oldCell || !oldCell.letter)) {
                  hasNewTiles = true;
                  break;
                }
              }
              if (hasNewTiles) break;
            }

            if (hasNewTiles) {
              debug('[GameBoard] New tiles detected, playing sound');
              this.playClickSound();
            }
          }

          // Update player count from game state to ensure consistency
          if (newGameState.playerCount) {
            this.playerCount = newGameState.playerCount;
          }

          // Arrival diffing: name the squares that just changed. The words
          // covering them become the latest on both surfaces (S3, §9.5).
          // Fresh arrivals persist until the next change: a quiet poll must
          // never wipe the latest flags it just helped paint.
          const { snap, fresh } = diffFresh(this.boardSnap, newGameState.board);
          this.boardSnap = snap;
          if (fresh.size) this.freshKeys = fresh;

          this.gameState = newGameState;

          // Mirror the server's dictionary selection, but only when the server's value changed,
          // so a poll can't flicker a checkbox the user just toggled.
          const serverDicts = JSON.stringify(newGameState.dictionaries || null);
          if (newGameState.dictionaries && serverDicts !== this.lastServerDictionaries) {
            this.lastServerDictionaries = serverDicts;
            this.selectedDictionaries = { ...newGameState.dictionaries };
          }

          // Check if game just ended
          if (newGameState.gameOver && this.gamePersistence.currentGameId.value) {
            const currentGame = this.gamePersistence.getCurrentGame();
            if (currentGame && currentGame.status !== 'completed') {
              debug('[GameBoard] Game ended, completing it');
              this.gamePersistence.completeGame(newGameState);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch game state:', error);
      }
    },
    getTilesRemainingClass() {
      const remaining = this.tilesRemaining;
      if (remaining > 50) return 'tiles-high';
      if (remaining > 25) return 'tiles-medium';
      if (remaining > 10) return 'tiles-low';
      return 'tiles-critical';
    },
    // Adopt a server state with arrival diffing (see the phone view).
    adoptGameState(newGameState) {
      if (!newGameState) return;
      const { snap, fresh } = diffFresh(this.boardSnap, newGameState.board);
      this.boardSnap = snap;
      if (fresh.size) this.freshKeys = fresh;
      this.gameState = newGameState;
    },
    // A history word wears its board rank (R26). Invalid words never landed,
    // so they stay unhued: a verdict needs no colour (R7).
    wordCueClass(entry, idx) {
      const cue = entry.wordCues?.[idx];
      if (!cue) return {};
      return {
        wword: true,
        'wx-a': cue.pole !== 'b',
        'wx-b': cue.pole === 'b',
        wlatest: cue.latest,
      };
    },
    wordCueStyle(entry, idx) {
      const cue = entry.wordCues?.[idx];
      return cue ? { '--rank': String(cue.rank) } : {};
    },
    wordCuePole(entry, idx) {
      return entry.wordCues?.[idx]?.pole || null;
    },
    async handleCellClick({ row, col }) {
      // Update viewport center
      try {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'update-viewport',
            viewportCenter: { row, col },
          }),
        });
      } catch (error) {
        console.error('Failed to update viewport:', error);
      }
    },
    toggleQR() {
      this.showQR = !this.showQR;
    },
    async handlePass() {
      const currentPlayer = this.gameState?.currentPlayer || 1;

      try {
        const response = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'pass',
            playerId: Number(currentPlayer),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          this.adoptGameState(result.gameState);
        }
      } catch (error) {
        console.error('Failed to pass turn:', error);
      }
    },
    async restartGame() {
      if (!confirm('Are you sure you want to restart the game? All progress will be lost.')) {
        return;
      }

      try {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'restart',
            playerCount: this.playerCount,
          }),
        });
        await this.fetchGameState();

        // Initialize new game in persistence
        if (this.gameState) {
          this.gamePersistence.startNewGame(this.gameState);
        }
      } catch (error) {
        console.error('Failed to restart game:', error);
      }
    },
    recordMoveFromHistory(gameState, playerNum, historyEntry) {
      // Extract move details from the backend history entry
      // Map backend action to our action types
      const action =
        historyEntry.action === 'play'
          ? 'play-word'
          : historyEntry.action === 'pass'
            ? 'pass'
            : historyEntry.action === 'exchange'
              ? 'exchange'
              : 'play-word';

      const metadata = {
        playerId: playerNum,
        tilesPlaced: historyEntry.tiles || [],
        wordsFormed: historyEntry.words || [],
        scoreBefore: gameState[`player${playerNum}`]?.score - (historyEntry.points || 0) || 0,
        rackBefore: [], // We don't have rack before from history
        valid: true,
      };

      // Add move-specific data based on action type
      if (historyEntry.action === 'exchange') {
        metadata.tilesExchanged = historyEntry.tiles?.length || 0;
      }

      debug('[GameBoard] Recording move from history:', {
        action,
        playerNum,
        historyEntry,
        metadata,
        gameState: {
          hasBoard: !!gameState.board,
          boardLength: gameState.board?.length,
        },
      });

      this.gamePersistence.saveMove(gameState, action, metadata);
    },

    handleGameOverClose() {
      // When the game over modal is closed, complete the game if not already done
      if (this.gameState?.gameOver && this.gamePersistence.currentGameId.value) {
        debug('[GameBoard] Completing game on modal close');
        this.gamePersistence.completeGame(this.gameState);
      }
      // Navigate to game history to see the completed game
      this.$router.push('/history');
    },
    // Local mode only: the backend knows which lists are built in or imported. With a laptop host nothing changes.
    async loadInstalledLists() {
      try {
        const status = await getBackend()?.listStatus?.();
        if (status)
          this.installedLists = Object.keys(status).filter(
            (id) => status[id].shipped || status[id].imported
          );
      } catch {
        this.installedLists = null;
      }
    },
    async handleDictionaryUpdate(selection) {
      // Ensure at least one is selected
      if (!selection.csw21 && !selection.nwl2023 && !selection.enable && !selection.slovenian) {
        alert('At least one dictionary must be selected');
        return;
      }

      this.selectedDictionaries = selection;

      try {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'update-dictionary',
            dictionaries: selection,
          }),
        });
        await this.fetchGameState();
      } catch (error) {
        console.error('Failed to update dictionary:', error);
      }
    },
  },
};
</script>

<style>
#app {
  font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* Flat ground in both themes; the page never carries a gradient (R1: a hue
     that names nothing is removed, not muted). */
  background: var(--surface-0);
  min-height: 100vh;
  color: var(--ink);
  padding: 0;
  margin: 0;
  max-width: 100%;
  width: 100%;
}

.desktop-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  gap: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.board-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 12px 20px 20px;
  min-width: 0;
  height: 100vh;
  overflow: hidden;
}

/* Always-visible compact score strip: one row, chips left, tiles pill right.
   Chips carry identity (the printed seat number), score, last-move delta, and
   a turn marker (● plus a steady fill, so turn state never depends on colour
   alone). Seat hues were removed: with 2–4 seats a hue ramp teaches nothing,
   and hue is reserved for word identities (S3). */
.score-topbar {
  width: 100%;
  max-width: 940px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.top-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  overflow-x: auto;
  padding: 2px;
}

.top-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.12));
  background: var(--surface-1, rgba(255, 255, 255, 0.04));
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.top-dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ink-faint);
  opacity: 0.9;
}

.top-name {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.6px;
  color: var(--ink-muted, #8e8e99);
}

.top-score {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--ink);
}

.top-delta {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--success);
}

.top-turn {
  font-size: 0.6rem;
  line-height: 1;
  color: var(--accent);
}

.top-chip.active {
  border-color: var(--accent-edge);
  background: var(--accent-soft);
}

.tiles-pill {
  flex: 0 0 auto;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 12px;
  border-radius: 999px;
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.12));
  background: var(--surface-1, rgba(255, 255, 255, 0.04));
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ink-muted, #a1a1aa);
  white-space: nowrap;
}

/* The sidebar is a matte panel beside the ground: flat fill, hairline edge,
   no blur and no shadow. Blur is reserved for floating instruments (R10). */
.sidebar {
  width: 380px;
  height: 100vh;
  background: var(--surface-1);
  border-left: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
  display: flex;
  flex-direction: column;
  overflow-y: auto; /* Changed from hidden to allow scrolling but not clip tooltips */
  overflow-x: visible;
  position: relative;
  z-index: 100; /* Ensure sidebar content is above board */
}

.sidebar-header {
  display: flex;
  gap: 10px;
  padding: 15px;
  border-bottom: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
  background: var(--surface-2);
}

.icon-button {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.2));
  color: var(--ink);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  padding: 10px 12px;
  min-width: 44px;
  min-height: 44px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.icon-button:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.icon-button:active {
  transform: translateY(0) scale(0.97);
  transition-duration: 60ms;
}

.qr-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 15px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.players-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  padding: 20px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.player-card {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 12px;
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out),
    opacity var(--dur-quick) var(--ease-out);
  opacity: 0.6;
  position: relative;
  overflow: hidden;
}

.player-badge {
  width: 50px;
  height: 50px;
  background: var(--surface-3);
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-seat {
  font-size: 1rem;
  font-weight: 800;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
}

.player-info {
  flex: 1;
  text-align: left;
}

.player-card:hover {
  transform: translateY(-1px);
  border-color: var(--accent-edge);
}

/* The current turn is one steady state: full opacity, the accent edge, a
   quiet fill. The badge never spins and nothing glows on a loop (R14). */
.player-card.active {
  opacity: 1;
  background: var(--accent-soft);
  border-color: var(--accent-edge);
}

.player-card.active .player-seat {
  color: var(--ink);
}

.player-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ink-muted, #a1a1aa);
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.player-card.active .player-name {
  color: var(--ink);
}

.player-score {
  font-size: 2rem;
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums lining-nums;
}

/* Tiles Remaining Counter: one honest number. The band names the count range
   with the shared status tokens, not four hand-picked hues. */
.tiles-remaining {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  border-bottom: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.05));
  background: var(--surface-1);
  opacity: 0.85;
}

.tiles-info {
  flex: 1;
}

.tiles-label {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--ink-faint, #71717a);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.tiles-count {
  font-size: 1.2rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ink-muted, #a1a1aa);
}

.tiles-high .tiles-count {
  color: var(--success);
}

.tiles-medium .tiles-count {
  color: var(--warn);
}

.tiles-low .tiles-count {
  color: var(--warn);
}

.tiles-critical .tiles-count {
  color: var(--danger);
}

.history-section {
  flex: 1;
  padding: 20px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: visible; /* Allow tooltips to escape */
  position: relative;
  z-index: 1; /* Ensure proper stacking */
}

.history-section h3 {
  margin: 0 0 15px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ink-muted, #a1a1aa);
  text-transform: uppercase;
  letter-spacing: 1px;
  flex-shrink: 0;
}

.history-table-wrapper {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  overflow-x: visible; /* Allow tooltips to extend outside */
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface-1);
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
  position: relative;
  font-variant-numeric: tabular-nums;
}

.history-table tbody tr {
  position: relative;
}

.history-table thead {
  background: var(--surface-2);
  border-bottom: 2px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
}

.history-table th {
  padding: 12px 8px;
  text-align: left;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-muted, #a1a1aa);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-right: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.05));
}

.history-table th:last-child {
  border-right: none;
}

.history-table tbody tr {
  border-bottom: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.05));
  transition: background-color 0.2s ease;
}

.history-table tbody tr:hover {
  background: var(--surface-2);
}

/* Row states: a valid play needs no wash — its words already carry their
   hues. An invalid play is a verdict: fill + ink, no glow (R7). Passes and
   exchanges recede into muted italics; the italic is set once, so rows never
   change height. */
.history-table tbody tr.valid-row {
  background: transparent;
}

.history-table tbody tr.invalid-row {
  background: var(--danger-soft);
}

.history-table tbody tr.exchange-row,
.history-table tbody tr.pass-row {
  font-style: italic;
  opacity: 0.7;
}

.history-table td {
  padding: 10px 8px;
  font-size: 0.9rem;
  color: var(--ink);
  border-right: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.05));
}

.history-table td:last-child {
  border-right: none;
}

.words-cell {
  font-weight: 500;
  text-transform: uppercase;
  font-size: 0.85rem;
  position: relative;
  overflow: visible;
}

.word-with-definition {
  cursor: help;
  position: relative;
  padding-bottom: 1px;
  border-bottom: 1px dotted var(--accent-edge, rgba(96, 165, 250, 0.5));
}

.word-with-definition:hover {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

/* Enhanced tooltip styling - using fixed positioning to escape all containers */
.word-with-definition[title]:hover::after {
  content: attr(title);
  position: fixed;
  right: 30px; /* Fixed distance from right edge of viewport */
  left: auto;
  top: 50%; /* Center vertically */
  transform: translateY(-50%);
  padding: 12px 16px;
  background: rgba(20, 20, 35, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(96, 165, 250, 0.4);
  border-radius: 8px;
  color: #e4e4e7;
  font-size: 0.85rem;
  line-height: 1.5;
  font-weight: 400;
  text-transform: none;
  white-space: normal;
  max-width: 320px;
  min-width: 220px;
  z-index: 99999;
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(96, 165, 250, 0.2);
  animation: tooltipFadeIn 0.2s ease-out;
  pointer-events: none;
}

.word-with-definition[title]:hover::before {
  content: '';
  position: fixed;
  right: 40px; /* Arrow positioned with tooltip */
  left: auto;
  top: 50%;
  transform: translateY(-50%) rotate(90deg);
  border: 7px solid transparent;
  border-top-color: rgba(96, 165, 250, 0.4);
  z-index: 99998;
  pointer-events: none;
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.score-cell {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}

.no-history {
  text-align: center;
  color: #71717a;
  font-style: italic;
  padding: 30px !important;
}

.message-section {
  padding: 15px;
  background: var(--surface-2);
}

.message-box {
  padding: 12px 15px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  border: 1px solid;
  border-radius: var(--radius-sm, 8px);
}

.message-box.success {
  background: var(--success-soft);
  color: var(--success);
  border-color: var(--success-edge);
}

.message-box.error {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: var(--danger-edge);
}

.message-box.info {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent-edge);
}

/* The reader's dials dock at the sidebar's foot; their sheet opens upward.
   Full-width anchor so the 300px sheet always has room (R19). */
.view-section {
  padding: 10px 15px 16px;
}
.view-section .view-cluster {
  display: block;
}
.view-section .view-cluster-summary {
  display: flex;
  width: fit-content;
  margin-left: auto;
}

/* Narrow widths: stack board over sidebar so the board keeps a usable size
   and scores/history stay reachable by scrolling the column (the score
   strip at the top always stays visible). */
@media (max-width: 920px) {
  .desktop-layout {
    flex-direction: column;
    height: 100dvh;
    overflow-y: auto;
  }

  .board-section {
    height: auto;
    flex: 0 0 auto;
    width: 100%;
    padding: 8px;
  }

  .score-topbar {
    max-width: 100%;
  }

  .sidebar {
    width: 100%;
    height: auto;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: none;
    overflow: visible;
  }

  .sidebar-header {
    padding: 10px;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* Compact the sidebar player cards into a denser strip; the topbar
     already carries scores, so these shrink to identity + score. */
  .players-container {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
    padding: 10px;
  }

  .player-card {
    padding: 8px;
    gap: 8px;
  }

  .player-badge {
    width: 32px;
    height: 32px;
    font-size: 1.1rem;
  }

  .player-name {
    font-size: 0.72rem;
    margin-bottom: 2px;
  }

  .player-score {
    font-size: 1.3rem;
  }

  .history-section {
    max-height: 260px;
  }
}
</style>
