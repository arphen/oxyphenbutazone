# Game Persistence System

## Overview

The game persistence system allows games to be saved and replayed move-by-move, similar to how chess websites like Lichess allow game analysis. Currently, games are stored in localStorage, but the system is designed to be easily extended to use a backend database.

## Features

- **Automatic game tracking**: Games are automatically initialized and tracked
- **Move-by-move recording**: Every move is captured with full context:
  - Board state before and after
  - Player racks before and after
  - Score changes
  - Tiles placed
  - Words formed
  - Timestamps
- **Game replay**: Step through games move-by-move
- **Game analysis**: View player racks at each move (optional toggle)
- **Game history**: List all completed and in-progress games

## Architecture

### Composable: `useGamePersistence.js`

Located at: `src/composables/useGamePersistence.js`

This composable handles all persistence operations:

#### Core Methods

- `startNewGame(gameState)` - Initialize a new game session
- `saveMove(gameState, action, metadata)` - Record a move with context
- `completeGame(finalGameState)` - Mark game as completed and save to history
- `getAllGames()` - Get all saved games
- `getGame(gameId)` - Get a specific game by ID
- `deleteGame(gameId)` - Remove a game from history
- `exportGame(gameId)` - Export game data (for backend sync)

#### Data Structure

Each game is stored with the following structure:

```javascript
{
  id: string,                    // Unique game ID
  startedAt: ISO timestamp,      // When game started
  lastMoveAt: ISO timestamp,     // Last move time
  completedAt?: ISO timestamp,   // When game ended
  status: 'in-progress' | 'completed',
  
  initialState: {                // Game state at start
    board: [...],
    player1: { score, rack, isCurrentPlayer },
    player2: { score, rack, isCurrentPlayer }
  },
  
  moves: [                       // Array of all moves
    {
      moveNumber: number,
      timestamp: ISO timestamp,
      playerId: string,
      action: 'play-word' | 'pass' | 'exchange',
      
      // Board states
      boardStateBefore: [...],
      boardState: [...],
      
      // Player states
      rackBefore: [...],
      rackAfter: [...],
      scoreBefore: number,
      scoreAfter: number,
      scoreDelta: number,
      
      // Move details
      tilesPlaced: [{row, col, letter, isBlank, chosenLetter}],
      wordsFormed: [{word, score, ...}],
      tilesExchanged: number,
      valid: boolean,
      message: string,
      
      // Full snapshot for replay
      gameStateSnapshot: {...}
    }
  ],
  
  finalState: {...},             // Game state at completion
  
  metadata: {                    // Game metadata
    player1Name: string,
    player2Name: string,
    finalScore1: number,
    finalScore2: number,
    winner: string,
    dictionary: {...}
  }
}
```

### Integration Points

The persistence system is integrated at the following points:

1. **Game Initialization** (`PlayerRackView-v2.vue`, `fetchGameState`)
   - Automatically creates a new game session when a fresh game is detected

2. **Move Actions** (`PlayerRackView-v2.vue`)
   - `playWord()` - Captures word plays with tiles, scores, and validation
   - `passTurn()` - Records pass actions
   - `handleSwapTiles()` - Records tile exchanges

3. **Game Completion** (`playWord()`)
   - Automatically saves completed games to history

## Views

### Game History View (`/history`)

Component: `src/views/GameHistory.vue`

Displays a list of all saved games with:
- Game status (completed/in-progress)
- Player names and scores
- Number of moves
- Duration
- Date played
- Actions: Analyze, Resume (for in-progress), Delete

### Game Replay View (`/replay/:gameId`)

Component: `src/views/GameReplay.vue`

Features:
- Step through moves with controls (first, previous, next, last)
- Slider to jump to any move
- Board state at each move
- Move details panel showing:
  - Player who made the move
  - Action type
  - Words formed
  - Score delta
  - Tiles placed
  - Timestamp
- Player state panel showing:
  - Current scores
  - Optional rack view (toggle)
- Move history list with quick navigation

## Future Backend Integration

To extend this to use a backend database:

### 1. Create Backend Endpoints

```python
# Django example
POST   /api/games/              # Create new game
PATCH  /api/games/{id}/         # Update game (add moves)
GET    /api/games/              # List all games
GET    /api/games/{id}/         # Get specific game
DELETE /api/games/{id}/         # Delete game
```

### 2. Update Composable

Replace localStorage operations with API calls:

```javascript
// In useGamePersistence.js

const saveToHistory = async (gameData) => {
  // Replace:
  // localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  
  // With:
  const response = await fetch(`/api/games/${gameData.id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gameData)
  });
  return response.json();
};

const getAllGames = async () => {
  // Replace:
  // const data = localStorage.getItem(STORAGE_KEY);
  
  // With:
  const response = await fetch('/api/games/');
  return response.json();
};
```

### 3. Database Schema

Suggested Django models:

```python
class Game(models.Model):
    game_id = models.CharField(max_length=100, unique=True)
    started_at = models.DateTimeField()
    last_move_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20)
    initial_state = models.JSONField()
    final_state = models.JSONField(null=True, blank=True)
    metadata = models.JSONField()

class Move(models.Model):
    game = models.ForeignKey(Game, related_name='moves', on_delete=models.CASCADE)
    move_number = models.IntegerField()
    timestamp = models.DateTimeField()
    player_id = models.CharField(max_length=10)
    action = models.CharField(max_length=20)
    board_state_before = models.JSONField(null=True, blank=True)
    board_state = models.JSONField()
    rack_before = models.JSONField()
    rack_after = models.JSONField()
    score_before = models.IntegerField()
    score_after = models.IntegerField()
    score_delta = models.IntegerField()
    tiles_placed = models.JSONField()
    words_formed = models.JSONField()
    tiles_exchanged = models.IntegerField(null=True, blank=True)
    valid = models.BooleanField()
    message = models.TextField(blank=True)
    game_state_snapshot = models.JSONField()
```

### 4. Hybrid Approach (Recommended)

Keep localStorage as a cache/offline backup:

```javascript
const saveToHistory = async (gameData) => {
  // Save to localStorage first (instant, works offline)
  const games = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  // ... localStorage logic
  
  // Then sync to backend (when online)
  try {
    await fetch(`/api/games/${gameData.id}/`, {
      method: 'PATCH',
      body: JSON.stringify(gameData)
    });
  } catch (error) {
    console.error('Failed to sync to backend:', error);
    // Mark for retry later
  }
};
```

## Usage Example

```javascript
// In a component
import { useGamePersistence } from '@/composables/useGamePersistence';

const { startNewGame, saveMove, completeGame, getAllGames } = useGamePersistence();

// Start a new game
const gameId = startNewGame(initialGameState);

// Save a move
saveMove(currentGameState, 'play-word', {
  playerId: '1',
  rackBefore: ['A', 'B', 'C'],
  scoreBefore: 50,
  tilesPlaced: [{row: 7, col: 7, letter: 'A'}],
  wordsFormed: [{word: 'CAT', score: 10}]
});

// Complete the game
completeGame(finalGameState);

// Get all games
const games = getAllGames();
```

## Testing

To test the persistence system:

1. Start a new game from the home screen
2. Make several moves (play words, pass, exchange tiles)
3. Navigate to "Game History" from the home screen
4. Click "Analyze" on a game
5. Use the replay controls to step through moves
6. Toggle "Show Player Racks" to see what each player had

## Storage Limits

localStorage typically has a 5-10MB limit per origin. Each game with 50 moves is approximately:
- ~100KB per game
- ~50-100 games can be stored before hitting limits

Consider implementing:
- Auto-cleanup of oldest games
- Compression of board states
- Backend sync to offload old games
