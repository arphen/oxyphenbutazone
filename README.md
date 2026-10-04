# Scrabble Trainer

A Vue 3 + Vite game for 2–4 players to play Scrabble offline on a local network. One laptop hosts the game state via a Vite plugin; phones access `/rack/:playerId` to see their racks and place tiles.

## Features

- **15×15 Board** with all premium squares (Triple Word, Double Word, Triple/Double Letter)
- **2–4 Player Turns** with visual indicators
- **Dictionary Support**: CSW21, NWL2023, Slovenian (with automatic tile distribution)
- **Scoring**: Letter values, premium multipliers, BINGO bonus (+50 for all 7 tiles)
- **Mobile Rack View**: Real-time sync, drag-and-drop tile placement and reordering
- **Word Definitions**: Hover over played words in history to see definitions
- **Game Persistence**: Save and replay games move-by-move
- **Flashcard Mode**: Spaced-repetition word practice with 5 categories
- **Game Replay**: Step through any saved game with board and rack analysis
- **Language Tiles**: English and Slovenian tile distributions

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Host opens `http://localhost:5174/` (or next available port); players scan QR or navigate to `/rack/1`, `/rack/2`, etc.

## Routes

- **`/`** – Home (game setup)
- **`/game`** – 15×15 board view (host only)
- **`/rack/:playerId`** – Mobile rack view (players 1–4)
- **`/freeplay`** – Untimed practice
- **`/practice`** – Practice mode
- **`/flashcards`** – Word practice with spaced repetition
- **`/odd-one-out`** – Puzzle game (host)
- **`/odd-one-out-mobile`** – Puzzle game (mobile)
- **`/history`** – List of saved games
- **`/replay/:gameId`** – Step through a saved game

## API

Vite plugin exposes:

- **`GET /api/game-state`** – Full game state
- **`POST /api/action`** – Player actions:
  - `place-tile`, `set-blank-letter`, `recall`, `play-word`, `pass`, `exchange-tiles`, `reorder-rack`, `update-viewport`, `update-dictionary`, `validate-word`, `restart`
- **`GET /api/words`** – Dictionary words (filters: `?dictionary=`, `?length=`, `?contains=`, `?startsWith=`, etc.)
- **OddOneOut API** – `POST /api/odd-one-out/create`, `/join`, `/submit`, `GET /api/odd-one-out/state`, `POST /api/odd-one-out/update`

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Board, Rack, Controls, QR, ScoreHistory
│   ├── views/            # GameBoard-v2, PlayerRackView-v2, FreePlay, etc.
│   ├── composables/      # useGamePersistence, useFlashcards, useMoveAnalysis
│   ├── shared/rules.js   # Pure game rules (scoring, placement, tile bags)
│   ├── router/index.js   # All routes
│   └── main.js
├── public/
│   ├── CSW21.txt         # Collins Scrabble Words (~279k lines)
│   ├── NWL2023.txt       # NASPA Word List (~197k lines)
│   └── SLOVENIAN.txt     # Slovenian (~203k lines)
├── vite-plugin-game-api-v2.js   # API middleware, game state, dictionaries
└── vite.config.js
```

## Dictionaries

Place dictionary files (one word per line, with optional definition) in `public/`:

```
CSW21.txt       Collins Scrabble Words 2021 (international)
NWL2023.txt     NASPA Word List 2023 (North America)
SLOVENIAN.txt   Slovenian Scrabble (special characters: Č, Š, Ž)
```

Format: `WORD definition [metadata]` (definition is optional for validation).

## Known Limitations

- **Game state is in-memory**: Restarting the server loses all game state
- **Practice modes use English values**: Free play, practice and flashcards always show English letter points (the live game, phone racks and replays use the game's language)
- **Persistence records two players only**: saved history/replay captures players 1 and 2, so 3–4 player games are not fully recorded

## Tech Stack

Vue 3, Vite, Vue Router, qrcode-vue3, scoped component CSS.

## Author

Sebastian Wozny <sebastian.wozny@pm.me>

## License

Private practice project
