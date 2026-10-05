# Oxyphenbutazone Design Tokens

Single source of truth: `frontend/src/style.css` (`:root` + `[data-theme]`
overrides). Every component consumes tokens via `var(--token, <fallback>)`
so nothing breaks if the base layer loads late. **No Scrabble palette**:
no khaki/beige/brown/tan board or tile imitation — tiles are light
“porcelain” in both themes, premium squares are jewel tints.

## Token table

| Token family              | Tokens                                                                                      | Meaning                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `surface`                 | `--surface-0` (page) → `--surface-3` (floating), `--surface-edge`, `--glass`/`--glass-edge` | Macro depth ladder. Blur (`backdrop-filter`) is allowed ONLY on `--glass` surfaces (badge, modals, overlays) — never per board cell / tile.                                                                     |
| `ink`                     | `--ink`, `--ink-muted`, `--ink-faint`                                                       | Text ladder. `--ink`/`--ink-muted` are AA on `--surface-0/1`; `--ink-faint` is large-text/icons only.                                                                                                           |
| `accent`                  | `--accent`, `--accent-ink`, `--accent-soft`, `--accent-edge`                                | Selection, links, drag targets, focus-adjacent highlights.                                                                                                                                                      |
| `primary`                 | `--primary`, `--primary-hover`, `--primary-pressed`, `--on-primary`                         | Primary buttons. White on `--primary` ≈ 6.2:1 dark / ≈ 9:1 light (AA).                                                                                                                                          |
| `success` `warn` `danger` | `--<s>-soft` (fill), `--<s>-edge` (ring), text-grade `--success/#178a4c` etc.               | Status + validation. **Validation wins over selection**: a green/red state overrides accent/selection styling, same rule as crossword.                                                                          |
| `tile`                    | `--tile-face-hi/lo`, `--tile-ink`, `--tile-sub`, `--tile-edge`, `--tile-glow`               | The porcelain tile. Theme-independent light face + dark ink = AAA letter contrast in both themes.                                                                                                               |
| `board`                   | `--board-bezel`, `--board-edge`, `--board-line`, `--board-cell`, `--board-cell-hover`       | Board chrome + empty cells.                                                                                                                                                                                     |
| `premium`                 | `--premium-dl/tl/dw/tw/center` + `-ink` mates                                               | Premium-square tints. Dark theme: translucent jewel tint + pale label. Light theme: light tint + dark label (both AA).                                                                                          |
| `focus`                   | `--focus-ring`                                                                              | 2px `:focus-visible` ring + offset, everywhere. Never remove without replacement.                                                                                                                               |
| motion                    | `--ease-out`, `--dur-quick` (160ms), `--dur-settle` (240ms)                                 | The one motion contract: `transform`/`opacity`/`border-color`/`background-color` only; hover lifts 1–2px; press scales 0.97–0.98 over 60ms; entrances play once (220ms); `prefers-reduced-motion` disables all. |

## Themes

- Default is dark. Light theme activates via OS `prefers-color-scheme`
  (only when no override is set) or explicitly via
  `<html data-theme="light|dark">`.
- Agents/tests: `window.__oxyTheme.set('light'|'dark'|null)` /
  `window.__oxyTheme.get()`; choice persists in `localStorage` (`oxy-theme`).
- `prefers-contrast: more` hardens `--surface-edge`/`--board-edge`.

## Component states (mini)

Buttons/choices/tiles implement all five visibly:
`hover` (lift + edge shift) · `press` (scale 0.97–0.98, 60ms) ·
`focus-visible` (2px `--focus-ring`) · `disabled` (opacity 0.45,
`not-allowed`, no lift) · `loading` (`.skeleton` shimmer from base layer).

## data-testid proposal (agent-readiness)

Already present: `board`, `cell-<r>-<c>` (`Board.vue`), `rack`,
`rack-tile-<i>` (`Rack.vue`), `score-strip`, `turn-status`, `hint`,
`notice`, `message`, `play-btn`, `recall-btn`, `shuffle-btn`, `swap-btn`,
`pass-btn` (`PlayerRackView-v2.vue`), `phone-board`, `empty-category`,
`list-problem`, `no-lists`, `setup-message`.

Proposed additions for layout/owner agents (additive, never rename):
`tile-<letter>-<value>` on placed tiles, `premium-<kind>` on empty premium
cells, `bag-count`, `pass-confirm`, `swap-modal`, `blank-picker`,
`game-over-modal`, `challenge-toast`. Keep kebab-case, stable across themes.

## Afterglow adoption (complete, guide v2)

All slices S1–S10 applied; acceptance is `npm run design:check` (static audit +
Playwright suite) plus the `design-e2e` CI job. Evidence: `e2e-design/design-evidence.md`.

- **Identity (S3).** Words on the board are the items; direction is the pole
  (horizontal warm 2→142, vertical cool 183→323). Rank = distinct strings
  sorted, index/(n−1), shared across poles (§3.3). Chips in history, tile ink
  traces, gate ticks, spill and the territory light all compute from `--rank`
  in CSS (`useWordCues.js` only names numbers). Engine history stores
  lowercase; matching uppercases at the boundary.
- **Seats are neutral** (number + steady accent fill for the current turn):
  with 2–4 seats a hue ramp teaches nothing, and hue is reserved for words.
- Interaction spends the accent; green/red (`--success`/`--danger`) are
  reserved for validation and win over selection (R7). Invalid history rows
  carry fill + ink with no glow and no hue.
- Nothing loops (R14): every remaining animation runs once; `prefers-reduced-motion`
  keeps all light. Root carries `overflow-x: clip` so the backlight layer can
  never widen the layout viewport and steal taps (guide §15 item 34).
- **Reader tiers (S5).** `useViewSettings.js` publishes `data-*` on `<html>`
  (stored choice beats media hint, unknown values fall back, single Reset);
  `ViewPanel.vue` (`details`/`summary`, tier accents, upward sheet) is mounted
  on the desktop sidebar and the phone view. Low-bloom dim/veil tiers drop all
  bloom. Dials compose; the `[D1]` matrix covers the corners.
- **Territory (S6).** Four registered corner ranks glide (900ms) as words are
  played; the ground's radials + conic bezel edge use exactly the on-screen
  word hues (R27). `[J5]` asserts the light moves.
- **Economy (S7).** Anchors mark playable squares; `--remaining` (tiles left)
  and `--libido` (1 − 8% per pass/exchange/invalid) feed `--charge`; help
  dims every light including the backlight. `[J8]` asserts the drain.
- **Celebration (S8).** Tiered finale (flawless/strong/steady/finished) with
  drawn check, rainbow rule, four stats and an honest note; sparks are flat
  ramp dots fired from the rule, finite, no canvas. `[J7]` reaches the finish.
- Glass (`backdrop-filter`) budget: phone dock, history tooltip, QR card,
  finale card — 4 rules, none repeated (R10).
- Remaining standard WARNs (non-blocking): hex fallbacks in `var()` (required
  pattern), text glyphs (★✕✓▶↩, not emoji presentation), none on layout.

## Checks

- `npm run build` in `frontend/` must pass.
- `npx prettier --check` on touched files must pass.
- Contrast spot-checks: `--ink`/`--ink-muted` on `--surface-0/1`,
  `--on-primary` on `--primary`, tile `--tile-ink` on `--tile-face-lo`,
  premium `-ink` on `-fill` — all targeted at WCAG AA (4.5:1) or better.
