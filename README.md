# Oxyphenbutazone

A word-tile game for two to four players that works **offline, phone to phone**. It runs entirely in the browser: no
account, no server, no internet once it is installed.

> Oxyphenbutazone is an independent hobby project and is not affiliated with or endorsed by any game publisher.

## Three ways to play

| | How | Needs |
| --- | --- | --- |
| **One device** | Open the app and start a game; pass the phone around. The game is saved and restored. | the app |
| **Phone to phone** | One phone **hosts**, others **join** by scanning a QR code, opening a link or pasting a code. | the app on each phone; same room (or a shared hotspot) |
| **Laptop host** | `npm run dev` on a laptop; phones open the QR codes on the laptop's board screen. | same Wi-Fi |

Phone-to-phone details, security model and limits: [docs/P2P.md](docs/P2P.md).

## Install on your phone

Open the published site once, then *Add to Home Screen* (iPhone: Share menu; Android: Install). After that it starts with
no network. See [docs/DEPLOY.md](docs/DEPLOY.md) for publishing it yourself (GitHub Pages) and
[docs/PHONE_TEST.md](docs/PHONE_TEST.md) for a checklist to run on real devices.

## Features

- 15×15 board with double/triple letter and word squares, 7-tile racks, 50-point bonus for using all seven tiles
- Two languages with their own tile sets and points: **English** and **Slovenščina** (fixed per game; a blank tile can
  only stand for a letter of the game's alphabet)
- Word lists: **ENABLE** (open) and **Slovenian** are built in; **CSW21** and **NWL2023** can be imported from your own
  file (*Word lists* screen) and are remembered on the device ([docs/DICTIONARIES.md](docs/DICTIONARIES.md))
- Placement rules: one line, no gaps, connected to the board, first word on the centre square; invalid words cost the turn
- Phone view: the whole board with pan and pinch-zoom, tap a tile then a square to place it, tap a placed tile to take it
  back, large Play / Recall / Shuffle / Swap / Pass buttons
- Game history and move-by-move replay, word definitions, flashcards, practice scenarios, free play
  ([docs/FEATURES.md](docs/FEATURES.md))

## Develop

```bash
cd frontend
npm install
npm run dev        # laptop-host mode; open http://localhost:5174/ (add ?mode=local to run the standalone app instead)
npm test           # unit tests (Vitest)
npm run e2e        # browser end-to-end tests: real Chromium, real WebRTC (see frontend/e2e/README.md)
npm run build      # static site in frontend/dist
npm run lint
```

`OXY_EXCLUDE_LISTS=csw21,nwl2023 npm run build` builds the way the public deployment does (without the copyrighted lists).

## How it is built

```
frontend/
├── src/
│   ├── shared/        # pure code, runs everywhere: engine.js (rules/turns), rules.js (scoring, placement, tiles),
│   │                  # protocol.js (validation of everything untrusted), dictionary.js, wordlist.js
│   ├── net/           # standalone app plumbing: local backend + fetch interceptor, WebRTC pairing and sessions,
│   │                  # QR helpers, word-list storage
│   ├── views/         # screens (Home, Host, Join, WordLists, phone rack view, board, history, practice modes)
│   ├── components/    # Board, PhoneBoard, QR scanner/display, modals
│   └── utils/         # URL helpers, logging, wake lock, pan/zoom maths
├── e2e/               # browser suites (npm run e2e)
├── public/            # word lists, sounds, manifest, icons
├── vite-plugin-game-api-v2.js   # laptop-host mode: thin HTTP shell around the shared engine
└── vite-plugin-offline.js       # build: word-list manifest, service worker, content-security-policy
```

The same engine runs in three places: in the laptop dev server, in the browser of a single device, and in the browser of
the host phone. The screens talk to it through `/api/*` calls; in the standalone app a small interceptor
(`src/net/api.js`) answers those calls from the in-browser engine instead of a server, so no screen needed rewriting.

### Security

Every device treats every other device as untrusted: actions and game states are rebuilt from a whitelist, sizes and
ranges are checked, pairing codes are validated, guests are pinned to their seat and rate-limited, and the production
build ships a strict Content-Security-Policy. This is input hygiene, not anti-cheat: whoever hosts can see everything.
Details in [docs/P2P.md](docs/P2P.md).

## Known limitations

- Verified in desktop Chromium only. iPhone Safari, local-network discovery between real phones, the camera in real
  light, and screen locking have not been tested on devices (see [docs/PHONE_TEST.md](docs/PHONE_TEST.md)).
- Playing across different networks (e.g. 5G) may need a relay server that this app does not include.
- The Slovenian list is a general word list, not an official tournament list.
- Saved history and replays record players 1 and 2 only.
- The odd-one-out multiplayer mode needs the laptop host.

## Author

Sebastian Wozny <sebastian.wozny@pm.me>

## License

Private practice project
