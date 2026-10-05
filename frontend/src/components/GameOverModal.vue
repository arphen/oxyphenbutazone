<template>
  <transition name="modal-fade">
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
      <!-- The finale card: one glass instrument (R10). How much happens
        scales with how much was played and whether anything went wrong
        (§11): sparks are flat dots in the ramp's own colours, finite, with
        no canvas and no glow. The message tells the truth about *how* the
        finish was reached (R28). -->
      <div class="modal-content finale" :class="stats.grade">
        <svg class="finale-mark" viewBox="0 0 48 48" aria-hidden="true">
          <path
            d="M14 25l9 9 12-20"
            fill="none"
            stroke="currentColor"
            stroke-width="4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>

        <h2 class="title">{{ title }}</h2>
        <div class="finale-rule-wrap">
          <div class="finale-rule" aria-hidden="true"></div>
          <div v-if="sparkCount > 0" class="sparks" aria-hidden="true">
            <i v-for="n in sparkCount" :key="n" class="spark" :style="sparkStyle(n)"></i>
          </div>
        </div>
        <p class="finale-line">{{ stats.line }}</p>
        <p class="finale-note">{{ stats.moves }} moves · {{ stats.helps }} helps used</p>

        <div v-if="!isTie" class="winner-announcement">
          <div class="winner-badge">
            <span class="winner-name">{{ winnerName }}</span>
            <span class="winner-label">wins</span>
          </div>
        </div>

        <div class="finale-stats">
          <div class="finale-stat">
            <span class="stat-value">{{ stats.moves }}</span>
            <span class="stat-label">Moves</span>
          </div>
          <div class="finale-stat">
            <span class="stat-value">{{ stats.best ? stats.best.word : '—' }}</span>
            <span class="stat-label">Best word{{ stats.best ? ` +${stats.best.score}` : '' }}</span>
          </div>
          <div class="finale-stat">
            <span class="stat-value">{{ stats.helps }}</span>
            <span class="stat-label">Helps used</span>
          </div>
          <div class="finale-stat">
            <span class="stat-value">{{ stats.invalids }}</span>
            <span class="stat-label">Invalid plays</span>
          </div>
        </div>

        <!-- Standings -->
        <div class="podium-container">
          <div
            v-for="(player, index) in sortedPlayers"
            :key="index"
            class="podium-player"
            :class="[{ 'is-winner': player.isWinner }]"
          >
            <div class="place-medal">
              <span>{{ ordinal(index + 1) }}</span>
            </div>

            <div class="player-avatar">
              <span>P{{ player.playerNum }}</span>
            </div>
            <div class="player-name">Player {{ player.playerNum }}</div>

            <div class="score-breakdown">
              <div class="breakdown-line">
                <span class="label">Game Score:</span>
                <span class="value">{{ player.gameScore }}</span>
              </div>
              <div v-if="player.penalty > 0" class="breakdown-line penalty-line">
                <span class="label">Remaining Tiles:</span>
                <span class="value">-{{ player.penalty }}</span>
              </div>
              <div v-if="player.bonus > 0" class="breakdown-line bonus-line">
                <span class="label">Opponent Tiles:</span>
                <span class="value">+{{ player.bonus }}</span>
              </div>
              <div class="breakdown-line final-line">
                <span class="label">Final Score:</span>
                <span class="value final-value">{{ player.finalScore }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="explanation">Final scores adjusted for remaining tiles</div>

        <!-- Action Buttons -->
        <div class="button-row">
          <button @click="$emit('new-game')" class="action-btn new-game-btn">
            <span>New Game</span>
          </button>
          <button @click="$emit('close')" class="action-btn close-btn">
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'GameOverModal',
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    winner: {
      type: Number,
      default: null,
    },
    gameState: {
      type: Object,
      default: null,
    },
    // Legacy props for backwards compatibility
    finalScore1: Number,
    finalScore2: Number,
    gameScore1: Number,
    gameScore2: Number,
    remaining1: Number,
    remaining2: Number,
  },
  computed: {
    playerCount() {
      return this.gameState?.playerCount || 2;
    },
    isTie() {
      return this.winner === 0;
    },
    winnerName() {
      if (this.isTie) return '';
      return `Player ${this.winner}`;
    },
    // Celebration tiers (§11.1): pure arithmetic from how the game was
    // reached. Each tier adds one finite layer, capped, never looping.
    // reached. Passes, exchanges and invalid plays all cost the turn, so all
    // three count as help (R25). The note stays honest about what went wrong.
    stats() {
      let moves = 0;
      let passes = 0;
      let exchanges = 0;
      let invalids = 0;
      let best = null;
      for (let i = 1; i <= this.playerCount; i++) {
        const history = this.gameState?.[`player${i}`]?.history || [];
        for (const entry of history) {
          if (entry.action === 'pass') passes++;
          else if (entry.action === 'exchange') exchanges++;
          else if (entry.action === 'invalid') invalids++;
          else {
            moves++;
            for (const word of entry.words || []) {
              if (!best || word.score > best.score) best = word;
            }
          }
        }
      }
      const helps = passes + exchanges + invalids;
      let grade = 'finished';
      let title = 'Finished';
      let line = 'That one fought back, and you got it anyway.';
      if (moves > 0 && invalids === 0 && exchanges === 0 && passes <= 1) {
        grade = 'flawless';
        title = 'Flawless';
        line = 'Played clean, start to finish.';
      } else if (invalids === 0 && exchanges === 0) {
        grade = 'strong';
        line = 'Clean work, start to finish.';
      } else if (exchanges + invalids <= 2) {
        grade = 'steady';
        line = 'A real game, with a few detours.';
      }
      return { moves, passes, exchanges, invalids, helps, best, grade, title, line };
    },
    title() {
      if (this.isTie) return 'Tied game';
      return this.stats.title;
    },
    // Sparks per game, with a global budget: a quiet lift for one move,
    // a few sparks for several, the full set for a flawless sweep (§11.1).
    sparkCount() {
      const moves = this.stats.moves;
      let sparks = moves <= 1 ? 0 : moves <= 4 ? 3 : moves <= 9 ? 6 : 9;
      if (this.stats.grade === 'flawless' && moves >= 4) sparks = 13;
      return Math.min(sparks, 160);
    },
    sortedPlayers() {
      const players = [];

      // Collect all player data
      for (let i = 1; i <= this.playerCount; i++) {
        const finalScore =
          this.gameState?.finalScores?.[`player${i}`] ||
          (i === 1 ? this.finalScore1 : this.finalScore2) ||
          0;
        const gameScore =
          this.gameState?.[`player${i}`]?.score ||
          (i === 1 ? this.gameScore1 : this.gameScore2) ||
          0;
        const remaining =
          this.gameState?.finalScores?.[`player${i}Remaining`] ||
          (i === 1 ? this.remaining1 : this.remaining2) ||
          0;

        // Calculate bonus (opponent tiles if this player finished first)
        let bonus = 0;
        if (remaining === 0) {
          // This player might have finished - check if they get opponent tiles
          bonus = Math.max(0, finalScore - gameScore);
        }

        players.push({
          playerNum: i,
          finalScore,
          gameScore,
          penalty: remaining,
          bonus,
          isWinner: this.winner === i,
        });
      }

      // Sort by final score (descending)
      return players.sort((a, b) => b.finalScore - a.finalScore);
    },
  },
  methods: {
    ordinal(n) {
      if (n === 1) return '1st';
      if (n === 2) return '2nd';
      if (n === 3) return '3rd';
      return `${n}th`;
    },
    // Each spark leaves at its own angle and reach, in the ramp's own
    // colours (the full 46→332 sweep), so the colours the reader has been
    // learning are the ones that fall (§11.4). Flat dots: a bright screen
    // has nothing to bloom.
    sparkStyle(n) {
      const angle = (((n * 137.5) % 360) * Math.PI) / 180;
      const dist = 44 + ((n * 53) % 72);
      const hue = 46 + ((n * 89) % 287);
      const size = 2 + (n % 4);
      return {
        '--dx': `${Math.round(Math.cos(angle) * dist)}px`,
        '--dy': `${Math.round(Math.sin(angle) * dist)}px`,
        '--hue': hue,
        width: `${size}px`,
        height: `${size}px`,
        animationDuration: `${800 + ((n * 37) % 400)}ms`,
      };
    },
  },
};
</script>

<style scoped>
/* Modal Transitions: one entrance, then rest. */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

/* The finale card: one floating glass instrument (R10) with a 26px radius.
   Everything on it is matte; the light comes from the rule and the sparks. */
.finale {
  background: color-mix(in oklab, var(--surface-1, #161c24) 76%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid color-mix(in oklab, var(--ink, #f2f2f6) 10%, transparent);
  box-shadow:
    inset 0 1px 0 var(--surface-glint, #ffffff14),
    0 18px 40px -18px rgba(0, 0, 0, 0.6),
    0 2px 6px rgba(0, 0, 0, 0.3);
  border-radius: 26px;
  padding: 40px;
  max-width: 720px;
  width: 95%;
  max-height: 90vh;
  overflow-y: auto;
  animation: finaleArrive 420ms cubic-bezier(0.2, 1.35, 0.4, 1);
  text-align: center;
  position: relative;
}

@keyframes finaleArrive {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* The drawn checkmark: stroked once over 700ms, then held. Reduced motion
   shows it drawn without drawing it. */
.finale-mark {
  width: 56px;
  height: 56px;
  color: var(--success);
}

.finale-mark path {
  stroke-dasharray: 60;
  stroke-dashoffset: 60;
  animation: drawMark 700ms var(--ease-out, ease-out) 150ms forwards;
}

@keyframes drawMark {
  to {
    stroke-dashoffset: 0;
  }
}

.title {
  margin: 12px 0 0;
  font-size: 2rem;
  font-weight: 700;
  color: var(--ink);
}

.finale-rule-wrap {
  position: relative;
  margin: 14px auto 0;
  max-width: 420px;
}

/* The rainbow rule under the title: the full ramp sweep, at half strength —
   full strength and wider only for flawless (§11.3). */
.finale-rule {
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    oklch(0.8 0.11 46),
    oklch(0.8 0.11 100),
    oklch(0.8 0.11 142),
    oklch(0.8 0.11 183),
    oklch(0.8 0.11 230),
    oklch(0.8 0.11 280),
    oklch(0.8 0.11 332)
  );
  opacity: 0.55;
}

.finale.flawless .finale-rule {
  opacity: 1;
  height: 4px;
}

.finale-line {
  margin: 12px 0 0;
  font-size: 1rem;
  color: var(--ink);
}

.finale-note {
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
}

/* Sparks fire from the rule and fall once (§11.4). */
.sparks {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
}

.spark {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 50%;
  background: oklch(0.8 0.11 var(--hue, 200));
  animation-name: sparkFly;
  animation-timing-function: cubic-bezier(0.2, 0.7, 0.2, 1);
  animation-fill-mode: both;
}

@keyframes sparkFly {
  from {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(var(--dx, 0px), var(--dy, -60px)) scale(0.6);
  }
}

.winner-announcement {
  margin-top: 16px;
}

.winner-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid var(--success-edge);
  background: var(--success-soft);
}

.winner-name {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--ink);
}

.winner-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.finale-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 20px;
}

.finale-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 6px;
  border: 1px solid var(--surface-edge);
  border-radius: 10px;
  background: var(--surface-2);
}

.stat-value {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums lining-nums;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-label {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

/* Standings: matte rows; the winner keeps a quiet success wash — a result,
   not an interaction. Numbers stay tabular so columns never jitter. */
.podium-container {
  display: grid;
  gap: 8px;
  margin-top: 20px;
}

.podium-player {
  display: grid;
  grid-template-columns: 52px 44px 1fr;
  grid-template-areas:
    'medal avatar name'
    'medal scores scores';
  gap: 4px 12px;
  align-items: center;
  text-align: left;
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 12px;
  padding: 12px 16px;
}

.podium-player.is-winner {
  border-color: var(--success-edge);
  background: var(--success-soft);
}

.place-medal {
  grid-area: medal;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
}

.is-winner .place-medal {
  color: var(--success);
}

.player-avatar {
  grid-area: avatar;
  width: 44px;
  height: 44px;
  background: var(--surface-3);
  border: 1px solid var(--surface-edge);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--ink-muted);
}

.player-name {
  grid-area: name;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
}

.score-breakdown {
  grid-area: scores;
  display: grid;
  gap: 2px;
}

.breakdown-line {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--ink-muted);
}

.breakdown-line .value {
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}

.final-line {
  border-top: 1px solid var(--surface-edge);
  padding-top: 4px;
  margin-top: 2px;
}

.final-value {
  font-weight: 800;
  color: var(--ink);
}

.explanation {
  margin-top: 16px;
  font-size: 0.85rem;
  color: var(--ink-faint);
}

.button-row {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.action-btn {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--surface-edge);
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  background: var(--surface-2);
  color: var(--ink);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out),
    background-color var(--dur-quick) var(--ease-out);
}

.action-btn:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.action-btn:active {
  transform: translateY(0) scale(0.97);
  transition-duration: 60ms;
}

.new-game-btn {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}

.new-game-btn:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

@media (max-width: 560px) {
  .finale {
    padding: 28px 20px;
  }

  .finale-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Reduced motion removes motion, not light (R17): the mark stands drawn,
   the card still arrives as state, the sparks never start (§11.5). */
@media (prefers-reduced-motion: reduce) {
  .finale-mark path {
    stroke-dashoffset: 0;
  }

  .sparks {
    display: none;
  }
}
</style>
