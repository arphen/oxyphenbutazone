# Design evidence ledger (guide §17.9)

One row per slice: the red output before, the green after, and one sentence per
screenshot opened. Baselines live in `e2e-design/__screenshots__/` and are committed.
Linux baselines (CI's OS) are authoritative; see "Baselines" below.

| Slice            | Commit  | Red (before)                                    | Green (after)                                                                                                                                     | Screenshots opened and what they show                                                                                                                                             | Rules                      |
| ---------------- | ------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| S1 Tokens        | 5aecd01 | — (greenfield)                                  | audit: `tokens`, `registered-glow` PASS                                                                                                           | —                                                                                                                                                                                 | R6 R20                     |
| S2 Material      | 80964d9 | audit: `glass-budget` FAIL (50+ rules)          | audit: `glass-budget` PASS (4 rules)                                                                                                              | j1 (3 projects): salon headline with amber tail, mono eyebrows, matte cards, one amber button, no glass; j5: board is a matte square ground, porcelain tiles the lightest surface | R8 R9 R10 R11              |
| S3 Identity      | 292d9fc | audit: `identity-ramp` FAIL (no `--rank`)       | audit PASS; `identity-ranks-published`, `identity-on-two-surfaces`, `identity-colours-vary`, `identity-colour-follows-rank` green in all projects | j5: CAT/RAT warm ink traces, CAR/TOT/TOTS cool traces, the same five hues on the history chips; j2-played: the played word rests latest                                           | R1 R2 R3 R4 R6 R26 R27     |
| S4 Interaction   | 80964d9 | audit: `no-infinite` FAIL (30 hits)             | audit PASS; `no-infinite-animations` green; `[D3]` green                                                                                          | reduced-motion-selected: selected tile keeps its ring with motion off                                                                                                             | R7 R13 R14 R15 R17         |
| S5 View settings | 292d9fc | audit: `view-tiers` FAIL (no panel)             | audit PASS; `[D1]` matrix green (standard/dim × vivid/soft/bold); `[J3]` persist + `[J4]` reset green                                             | j3-panel-dim: pressed Dim in Mini green, dimmed board; j4-reset: defaults restored                                                                                                | R18 R19 R20 R21 R22        |
| S6 Territory     | 292d9fc | audit: `territory` FAIL (no `@property --ta-*`) | audit PASS; `[J5]` corner ranks shift green                                                                                                       | j5: ground corners glow in the on-screen word hues (warm left, cool right); the bezel edge sweeps the same four corners                                                           | R24                        |
| S7 Economy       | 292d9fc | audit: `economy` FAIL (no `--charge`)           | audit PASS; `[J8]` libido 1 → 0.92 green                                                                                                          | j8: anchors lit, charge drained by the pass                                                                                                                                       | R23 R24 R25                |
| S8 Celebration   | 292d9fc | audit: `celebration` FAIL                       | audit PASS; `[J7]` finale green                                                                                                                   | j7: drawn check, rainbow rule, "Finished / Clean work, start to finish.", 2 moves · 2 helps used, 3 sparks, honest penalties                                                      | R28 (voice: honest finish) |
| S9 Comments      | 80964d9 | —                                               | why-comments on every non-obvious rule                                                                                                            | —                                                                                                                                                                                 | R29                        |
| S10 Final        | 47a2287 | —                                               | `design:check` 0, `design-e2e` green                                                                                                              | all of the above, each opened                                                                                                                                                     | R28 R30 R31 R32            |

## Baselines

Initial set generated on macOS for functional review, then regenerated inside
`mcr.microsoft.com/playwright:v1.55.0-noble` (CI's OS family) and reviewed again;
the Linux set is committed. Local macOS runs may show font anti-aliasing diffs
against the Linux baselines; the Linux run is authoritative.

## Red herrings encountered (kept for the next agent)

- Phone tap timeout (`[J2]`-class): an unclosed paren in `--charge` dropped every
  CSS rule after `.oxy-ground` in the bundle (tiles rendered unstyled, layout
  pathological). Found by reading `document.styleSheets` rule counts in the page.
  Fix: the guide's exact formula. Lesson: check brace/paren balance (R31).
- Playwright `webServer` timed out twice: first a stray `vite preview` squatted on
  :4173 (`--strictPort` then crashes); then the config ran the server from the
  config's own directory. Fixes: kill strays, set `cwd` in `webServer`.
- Seed cluster `TA`+`AT` via T at (8,8) is invalid: it bridges CAT's A and RAT's A
  into ATA. The engine was right. Fixed cluster: CAT, CAR, RAT, TOT (O at (8,9)).
- History chips never matched: the engine stores lowercase words, the board scan
  reads uppercase. Match uppercases at the boundary; unit test pins it (R26).
- Contracts raced the 500ms UI poll and read an empty board. D1 and `seed()`
  now wait for `.wword` (matched hues), not just tiles.
- View panel unusable from the sidebar header: the upward sheet flew past the
  viewport top (desktop) and off the left edge from a wrapped row (phone).
  Desktop panel now docks at the sidebar foot; the phone panel is a full-width
  sheet above its trigger.
- Latest-word flags vanished between polls: `adoptGameState` replaced freshKeys
  even when the diff was empty. Fresh arrivals now persist until the next change.
- Pressed tier accents under 4.5:1 on paper (mini green 3.37:1, micro amber
  4.13:1) — guide §15 item 32 verbatim. Tier keeps its hairline, text returns
  to ink in the light theme.
- Phone journeys used the desktop ground selector. The suite only drives the
  desktop board for territory/charge, so the helper targets `.board.oxy-ground`.
- `[J2]` flaked in CI: it clicked rack tile 0 before the seeded rack reached the
  screen and staged a random letter from the old rack. Now it waits for the
  tile's letter to read C first, the way the smoke suite already did.
- Custom suites `static`, `words`, `offline`, `practice`, `laptop` fail
  identically on a clean checkout (proven via `git stash`): the Friendly word
  list landed without updating their expectations (chooser offers 5 lists, not
  4; game states carry a `friendly` key). Pre-existing feature drift, not this
  pass; CI runs `smoke` only, so nothing green turned red.
- `oddoneout` failed once on `3-Letter Extensions` generating five valid words
  (no odd one out): generator randomness, untouched by this pass (category ids
  identical; only icon strings changed). Passed on re-run. Two of its verdict
  strings (`Correct!`, `Oops!`, `Next Puzzle`) are pinned by its suite and were
  restored verbatim after a voice edit broke them.
