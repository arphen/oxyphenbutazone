# Phone-to-phone play

Two to four phones play one game with no server and no internet once the app is installed. One device **hosts**
(it runs the game engine in its browser); the others **join**. The laptop dev server is a separate, older way to play
and is not involved.

## Pairing

1. **Host** opens *Play with a friend → Host a game*, picks language and players, taps *Invite player 2*.
2. The invite is shown as a **QR code**, a **link** and a **copyable code** (`OXY2.…`, about 700–1200 characters
   depending on network candidates; older `OXY1.…` codes still scan). The QR holds the bare code to keep it small —
   if it will not scan, copy/share the link instead.
3. **Guest** opens *Join a game* and scans the QR (📷), opens the link, or pastes the code, then taps *Join*.
4. The guest's phone shows an **answer** (QR + code). The host scans it (📷) or pastes it and taps *Connect*.
5. A WebRTC data channel opens; the guest jumps to their rack. Repeat per extra player.

The invite/answer are WebRTC session descriptions, compressed. There is no signalling server: you carry the two
messages yourselves. Same room: no STUN/TURN is needed (the phones find each other on the local network or on one
phone's hotspot). For two different networks tick *different networks* to add a public STUN server; strict carrier NAT
(common on 4G/5G) can still block a direct connection and would need a TURN relay, which is not built in.

If the host's phone sleeps or the page reloads, the game is saved (localStorage) and restored; the host taps
*Continue it*, invites again, and guests rejoin with a new handshake.

## Rejoining (the journey)

This is the flow users praised, so it is preserved as-is; the notes below explain why each step is shaped that way.

1. **Host reloads mid-game.** Every host action (including uncommitted placed tiles) is written to localStorage
   (`oxyphenbutazone_local_game_v1`, sanitized on load, unknown versions discarded). After a reload the Host
   screen offers *Continue it* when a game with moves is saved, and hosting starts a **new room id**. The game
   (scores, board, turn) is intact; only the pairing is new.
2. **Guest sees the drop.** The guest's pending actions resolve with *Connection to the host was lost* (never hang),
   and the badge reads *Connection to host lost* with a *Rejoin* link back to Join.
3. **Guest rejoins with a fresh handshake.** Old invites/answers name the old room, so the host answers
   *That answer belongs to a different game* instead of connecting nowhere. The guest scans the new invite, the
   host applies the new answer, and the guest's first message (`hello`) carries the full state: scores, board and
   turn reconcile at once. Anything the host sends afterwards is diffed in the same way (`state` after every change).
4. **A reloaded guest cannot auto-rejoin** (there is no server holding the invite), so Join tells it *You were
   Player N — ask the host for a fresh invite*. If an answer sits unapplied for ~20 s, Join suggests the invite
   may be stale rather than slow.

Why invites "expire" without a timestamp: the blob format is frozen (old installs must still scan), and two phones
share no clock, so there is nothing trustworthy to compare. Expiry is positional instead — the room id is minted
fresh per host session, and anything naming another room is refused with a message that says so. Clock skew is
handled the same spirit elsewhere: the host's rate limiter clamps negative time deltas so a phone clock stepping
backwards cannot drain the bucket and drop a good guest.

Turn-state reconciliation is host-authoritative by design: the guest never merges, it adopts the newest sanitized
state, keeping the last good one when a hostile/malformed state is rejected. A guest action sent while
reconnecting either lands on the live game or times out with *The host did not answer in time* — nothing is
half-applied, and a refresh mid-turn on the host loses nothing (covered by `src/net/rejoin.test.js`).

## Trust model

Every device treats every other device as untrusted. This is input hygiene, **not anti-cheat**: the host sees
everything and can bend the rules (by design: simplicity over policing).

| Boundary | What is enforced |
| --- | --- |
| Pairing blobs | size caps, safe parsing, decompression-bomb guard, SDP restricted to a plain data-channel offer (no media, readable ASCII, well-formed candidates) |
| Frames | max frame size, max message size, max half-received messages |
| Guest → host actions | rebuilt from a whitelist (`sanitizeAction`), ranges/types checked, pinned to the guest's seat, rate limited, disconnected after repeated violations |
| Host → guest state | rebuilt field by field (`sanitizeGameState`), sizes capped, control characters stripped; a host that keeps sending garbage is dropped |
| Engine | the tile placed is the tile in the rack (client claims ignored); rack reorders must be permutations; only the player on turn can place/recall/exchange/pass; no moves after the game is over |
| Storage | a saved game is sanitized when loaded; imported word lists are validated |

Code: `src/shared/protocol.js`, `src/net/signal.js`, `src/net/framing.js`, `src/net/hostSession.js`,
`src/net/guestSession.js`, `src/shared/engine.js`. Tests: `src/net/p2p.test.js`, `protocol.test.js`, `engine.test.js`.

## Messages (over the data channel, JSON in size-limited frames)

guest → host: `{t:'action', id, action}`, `{t:'ping'}`. host → guest: `{t:'hello', seat, state}`,
`{t:'state', state}` (after every change), `{t:'result', id, result}`, `{t:'pong'}`.

## Limits and things to test on real phones

- Browsers may hide local IPs behind `.local` (mDNS) names; two phones on one Wi-Fi normally resolve them, but some
  hotspots/guest networks block it. If pairing succeeds but never connects, try the other phone's hotspot or a
  different network. See `PHONE_TEST.md`.
- A phone that locks its screen suspends the page; the host keeps the screen awake (Wake Lock) while hosting.
- iPhone: add the app to the Home Screen for reliable offline storage. A hotspot on an iPhone with no signal is unverified.
