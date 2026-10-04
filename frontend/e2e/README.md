# Browser end-to-end tests

Real Chromium (via `playwright-core`, no browser download), real WebRTC, the built site. Run: `npm run e2e`
(or `npm run e2e -- p2p csp` for some suites). Needs a Chromium; set `CHROMIUM=/path/to/chromium` if it is not found.

| Suite | What it proves |
| --- | --- |
| `static` | the app runs with no API server: a full game, restore after reload, practice endpoints |
| `p2p` | two browsers pair through the real Host/Join screens over a real data channel, play both ways, seat/turn enforcement, host reload + rejoin, garbage invites |
| `offline` | install, cut the network, reload and play; public build ships no CSW21/NWL2023; fallback when a list is missing |
| `csp` | the Content-Security-Policy blocks injected scripts, handlers and foreign requests |
| `laptop` | dev-server mode: Slovenian game, rules hardening (size caps, bad JSON, `__proto__`, rack tampering), language/dictionary rules |

Page errors and CSP violations fail every suite. Not covered (needs real phones): iOS Safari, local-network discovery,
camera focus, screen locking. See `docs/PHONE_TEST.md`.
