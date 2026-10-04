# Browser end-to-end tests

Real Chromium (via `playwright-core`, no browser download), real WebRTC, the built site. Run: `npm run e2e`
(or `npm run e2e -- p2p csp` for some suites). Needs a Chromium; set `CHROMIUM=/path/to/chromium` if it is not found.

| Suite | What it proves |
| --- | --- |
| `static` | the app runs with no API server: a full game, restore after reload, practice endpoints |
| `ui` | the phone view driven by real taps: select tile + tap square, take it back, Play, Recall, Pass, Shuffle, not-your-turn |
| `p2p` | two browsers pair through the real Host/Join screens over a real data channel, play both ways, seat/turn enforcement, host reload + rejoin, garbage invites |
| `words` | import CSW21 from a file on the host (the public build ships none), host a game that uses it, a guest with no list gets its word checks answered from the host's list, import survives a reload |
| `scan` | the in-app QR scanner with a fake camera: scans an invite link, ignores a junk QR, handles a denied camera, stops the camera, and pairs two browsers by scanning both ways |
| `offline` | install, cut the network, reload and play; public build ships no CSW21/NWL2023; fallback when a list is missing |
| `csp` | the Content-Security-Policy blocks injected scripts, handlers and foreign requests |
| `oddoneout` | Odd One Out on the public build: only the installed lists (ENABLE, Slovenian) are offered, no multiplayer, every category gives a 5-word puzzle with exactly one non-word, scoring and feedback for a right and a wrong answer, too-small categories are refused, no corpus file is requested |
| `practice` | Free Play, Flashcards and Practice scenarios on the public build (ENABLE only): Free Play recognises a real word and rejects others, the chooser offers only installed lists and no CSW21/NWL2023 file is requested; every flashcard category loads cards and an answer is accepted; all 11 practice scenarios load and are solved by their real answer, wrong plays are told apart; a CSW21-style file imported on the word lists screen is then what Free Play (and Flashcards) use; with no list at all Free Play says so |
| `laptop` | dev-server mode: Slovenian game, rules hardening (size caps, bad JSON, `__proto__`, rack tampering), language/dictionary rules |

Page errors and CSP violations fail every suite. Not covered (needs real phones): iOS Safari, local-network discovery,
camera focus, screen locking. See `docs/PHONE_TEST.md`.
