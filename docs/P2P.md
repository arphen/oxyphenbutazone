# Phone-to-phone play

Two to four phones play one game with no server and no internet once the app is installed. One device **hosts**
(it runs the game engine in its browser); the others **join**. The laptop dev server is a separate, older way to play
and is not involved.

## Pairing

1. **Host** opens *Play with a friend → Host a game*, picks language and players, taps *Invite player 2*.
2. The invite is shown as a **QR code**, a **link** and a **copyable code** (`OXY1.…`, about 600–900 characters).
3. **Guest** opens *Join a game* and scans the QR (📷), opens the link, or pastes the code, then taps *Join*.
4. The guest's phone shows an **answer** (QR + code). The host scans it (📷) or pastes it and taps *Connect*.
5. A WebRTC data channel opens; the guest jumps to their rack. Repeat per extra player.

The invite/answer are WebRTC session descriptions, compressed. There is no signalling server: you carry the two
messages yourselves. Same room: no STUN/TURN is needed (the phones find each other on the local network or on one
phone's hotspot). For two different networks tick *different networks* to add a public STUN server; strict carrier NAT
(common on 4G/5G) can still block a direct connection and would need a TURN relay, which is not built in.

If the host's phone sleeps or the page reloads, the game is saved (localStorage) and restored; the host taps
*Continue it*, invites again, and guests rejoin with a new handshake.

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
