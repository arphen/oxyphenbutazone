# Game Features

## Word Definitions

Words played in-game display their definitions on hover in the Game History table. The backend looks up definitions from the active dictionary (CSW21 → NWL2023 → Slovenian fallback). Format: `WORD definition text [metadata]`. Works for valid and invalid words alike.

**Tooltip behaviour**: Definitions appear below the hovered word with a smooth fade-in animation, styled with a semi-transparent dark background and blue border. Positioning uses `fixed` to break out of overflow-clipped parent containers and ensures tooltips always appear on top.

## Language-Specific Tile Distributions

The tile language is chosen on the home screen when a game starts and is fixed for that game:

- **English tiles**: 100 tiles with English point values (A=1, Q/Z=10, etc.)
- **Slovenian tiles**: 100 tiles with Slovenian point values (J=1 point, C=8 points, etc., includes Č, Š, Ž; no Q, W, X, Y)

A blank tile can only stand for a letter of the game's alphabet (the picker shows Č Š Ž in Slovenian games, and the server rejects anything else).

Choosing dictionaries (📚 button) changes which words are valid immediately but never the tiles. See [DICTIONARIES.md](DICTIONARIES.md) for how a new game picks its dictionary.

## Game Persistence & Replay

Games are automatically saved with move-by-move history (board state before/after, racks, scores, tiles placed, words formed, timestamps). Access via `/history` to see all saved games and click a game to replay it with `/replay/:gameId`.

**Replay controls**: Step through moves using first/previous/next/last buttons or a slider. View board state, move details (words formed, score delta, tiles placed), and optionally toggle player racks at each move.

**Storage**: Currently localStorage (~5–10MB limit); can be extended to a backend database.

## Flashcards: Word Practice with Spaced Repetition

A game mode for learning words. Pre-defined categories include 3-letter words with V/Q/J, all 2-letter words, and Q-without-U words. Words are organized into 4 buckets:

- **New**: Unseen words
- **Learning**: 1–2 consecutive correct answers
- **Reviewing**: 3–4 consecutive correct answers
- **Mastered**: 5+ consecutive correct answers

Each word is presented with a mini 7×7 board scenario (simple, hook, parallel, extension, or premium placement). Reveal the word, self-assess ("Got It Right" or "Need More Practice"), and advance or demote in buckets. Progress is saved to localStorage.

Access via `/flashcards` or the Home screen.

## Move Analysis

Game replay mode includes a "Analyze Move (Beta)" button to rate move quality (Excellent, Good, Okay, Weak) and compare actual score vs. potential best score. Currently a UI framework; full move suggestion requires a backend endpoint to compute best possible moves using the dictionary and tile bag.

## Multi-Player Games

Support for 2–4 players (configurable at game start). Each player has a rack, score, turn indicator, and move history. Consecutive passes end the game when all players have passed. Final scores deduct unplayed tiles (bonus to player who used all tiles).
