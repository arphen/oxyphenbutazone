# Rejoin e2e notes (for the Playwright suite owner)

Unit coverage for the rejoin journey already exists — `src/net/rejoin.test.js` (host reload mid-turn, guest
re-host handshake, double-rejoin guard, clock skew, corrupt saves) and
`src/composables/useGamePersistence.test.js` (history round-trips, quarantine, quota). Do NOT duplicate those in
the browser suite; cover what only real browsers prove: real WebRTC pairing through the actual Host/Join screens.

## Stable hooks (all `data-testid`, no styling hooks)

| Hook | Where | Notes |
| --- | --- | --- |
| `host-resume` | Host | *Continue it* — only rendered when a saved game with moves exists |
| `host-start`, `host-error` | Host | start button / start failure |
| `host-seat-N` | Host | per-seat card (`N` = 2..4); use instead of bare `host-invite-btn` for 3–4 player games |
| `host-invite-btn` | Host | *Invite player N* (first matching card in 2-player games) |
| `host-answer`, `host-connect`, `host-scan-btn` | Host | answer textarea / Connect / scan-the-answer |
| `host-seat-status`, `host-seat-error` | Host | `✓ Connected` / `Connection lost…` / per-seat error |
| `signal-text` | SignalBox | the pairing code (invite or answer); existing `.signal-text` class also works |
| `join-invite`, `join-submit`, `join-error` | Join | paste box / Join button / error |
| `join-scan-btn` | Join | *Scan the host's invite* |
| `join-was-guest-hint` | Join | *You were Player N…* — only when a previous guest seat is remembered and no `?c=` invite is present |
| `join-answer`, `join-wait` | Join | answer SignalBox / `⏳ Waiting…` → `✓ Connected!` |
| `join-stale-hint` | Join | appears ~20 s after the answer shows with no connection (*…ask them for a fresh invite…*) |
| `join-cancel` | Join | Cancel (leaves the pairing, back to the invite form) |
| `conn-badge`, `conn-action` | ConnectionBadge | badge text; the Rejoin/Players link |

## Suggested browser scenarios (not yet covered anywhere)

1. **Guest reloads mid-game** → lands on Home; opens Join manually; sees `join-was-guest-hint` naming its seat;
   pastes a fresh invite from the host; reconnects onto the same scores.
2. **Stale invite**: guest keeps an old invite (previous host session), taps Join → guest waits; host never sees it.
   Expect `join-stale-hint` after ~20 s (suite may stub timers or just assert presence of the hint logic via the
   20 s copy — do NOT assert engineered timing tightly; waiting the full 20 s in CI is fine once).
3. **Double-tap Join**: two rapid Join taps → exactly one answer shown; host applies it; guest connects once
   (unit pin: `rejoin.test.js` "two overlapping joins").
4. **Host Continue-it after reload with placed-but-unplayed tiles** → guest rejoin shows the `isNew` tiles
   (unit pin exists; browser asserts the guest actually renders them).
5. **Expired answer on the host**: apply an answer from a previous host session → `host-seat-error` says it
   belongs to a different game (unit pin: "the old answer belongs to a dead room").

## Deliberately NOT in the browser suite

- QR encoding/token shapes (`scan.test.js`, `p2p.test.js` signal codec) — frozen format, unit-covered.
- Word lists, dictionary fallback (`localBackend.test.js`) — unit-covered.
- Corrupt/quota storage (`rejoin.test.js`, `useGamePersistence.test.js`) — unit-covered with storage stubs.
