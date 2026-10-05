# Browser end-to-end tests

Real Chromium (via `playwright-core`, no browser download), real WebRTC, the built site. Run: `npm run e2e`
(or `npm run e2e -- p2p csp` for some suites). Needs a Chromium; set `CHROMIUM=/path/to/chromium` if it is not found.

| Suite | What it proves |
| --- | --- |
| `smoke` | the fast happy path in one place: home loads, host-create → guest-join via code/link, rejoin after host reload, a tapped-out move that scores on a phone viewport, BYOD word-list import. Run this first; the suites below go deeper |
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

## Harness design

`run.mjs` builds the public-style site (`OXY_EXCLUDE_LISTS=csw21,nwl2023`, like the
deployed site), serves it with `vite preview` on :4173, then runs each `*.e2e.mjs` suite
with `E2E_BASE` pointed at it (the `laptop` suite instead gets the dev server on :4174
with `OXY_TEST=1`). `lib.mjs` holds the shared bits: `launch()` (playwright-core +
system Chromium, no browser download), `newPage()` (an isolated storage context per
call at a 390x844 touch viewport, recording page errors and CSP violations), `api()`
(the app's own `/api` from inside the page), `noPageErrors()`.

`smoke.e2e.mjs` is the minimal reliable entry point: `npm run e2e -- smoke`. It uses
only explicit waits (`getByTestId(...).waitFor()`, `waitForFunction` on
`window.__oxy`/engine state, `waitForURL`), the paste flow instead of a real camera,
and stable `data-testid` hooks (`home-title`, `host-start`, `host-invite-btn`,
`signal-text`, `join-invite`, `join-submit`, `host-answer`, `host-connect`,
`host-resume`, `conn-badge`, `rack`, `score-strip`, `play-btn`, `word-status`,
`word-import`).

## Running locally / in CI

Needs a Chromium. Set `CHROMIUM=/path/to/chromium` if none is found; on macOS the
bundled Google Chrome is picked up automatically. There is no `playwright` dependency
on purpose (only `playwright-core`): on a fresh machine either point `CHROMIUM` at a
system browser or install one once with `npx playwright install chromium` (from a
separate `playwright` install) or the `browser-actions/setup-chrome` GitHub Action.

```sh
npm run e2e -- smoke   # the fast happy path (~1 min)
npm run e2e            # everything (builds once, then all suites incl. laptop)
npm run e2e -- p2p csp # only the named suites
```

CI (`.github/workflows/e2e.yml`) runs `vitest`, builds, installs system Chrome and runs
the smoke suite headless on every push to `main` and every pull request.
