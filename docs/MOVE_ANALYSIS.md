# Move Analysis Feature

## Overview
The move analysis feature allows players to analyze their moves in game replay mode, similar to chess engines showing the "best move" after a game.

## Current Implementation

### Files Created/Modified:
1. **`src/composables/useMoveAnalysis.js`** - Core analysis logic composable
2. **`src/views/GameReplay.vue`** - Integrated analysis UI into replay view

### Features Implemented:
- ✅ Move analysis button in replay mode
- ✅ Framework for finding best possible moves
- ✅ Move quality rating system (Excellent, Good, Okay, Weak)
- ✅ Score comparison (actual vs. potential)
- ✅ UI to display analysis results
- ✅ Caching of analysis results per move

### What Works Now:
- The UI and infrastructure are in place
- Analysis can be triggered for any played move
- The framework for comparing moves is ready
- Beautiful UI showing ratings and score differences

## What's Needed for Full Functionality

### Backend API Endpoint Required:

You need to create a backend endpoint that can:

```python
POST /api/find-best-move

Request:
{
  "board": [[...], [...]],  # 15x15 board state
  "rack": ["A", "B", "C", "D", "E", "F", "G"],  # Player's tiles
  "dictionary": {"sowpods": true, "twl": false},
  "currentPlayer": 1
}

Response:
{
  "found": true,
  "bestMove": {
    "word": "CABBAGE",
    "score": 67,
    "row": 7,
    "col": 7,
    "direction": "horizontal",
    "tilesPlaced": [
      {"row": 7, "col": 7, "letter": "C"},
      {"row": 7, "col": 8, "letter": "A"},
      ...
    ]
  },
  "alternativeMoves": [...]  # Optional: top 5 moves
}
```

### Backend Implementation Approach:

1. **Brute Force Search** (Simpler but slower):
   - Try all possible tile combinations (2-7 tiles)
   - For each combination, try all valid board positions
   - Validate each attempt using existing game logic
   - Return the highest scoring valid move

2. **Optimized Search** (More complex but faster):
   - Use a DAWG (Directed Acyclic Word Graph) data structure
   - Implement anchor-based word generation
   - Only check positions adjacent to existing tiles
   - Use move caching and pruning

3. **Algorithm Steps**:
   ```python
   def find_best_move(board, rack, dictionary):
       best_score = 0
       best_move = None
       
       # Find all anchor points (positions adjacent to tiles)
       anchors = find_anchor_points(board)
       
       for anchor in anchors:
           for direction in ['horizontal', 'vertical']:
               # Generate all possible words at this position
               for word in generate_words(rack, anchor, direction, dictionary):
                   # Validate and score the word
                   score = validate_and_score(board, word, anchor, direction)
                   
                   if score > best_score:
                       best_score = score
                       best_move = word
       
       return best_move
   ```

### Frontend Integration:

Once the backend endpoint exists, update `useMoveAnalysis.js`:

```javascript
const testMove = async (rack, board, startRow, startCol, length, direction, gameState) => {
    try {
        const response = await fetch('/api/find-best-move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                board,
                rack,
                dictionary: gameState.dictionary
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            return result.bestMove;
        }
    } catch (error) {
        console.error('Error finding best move:', error);
    }
    return null;
};
```

## Usage

1. Play a game (or load a saved game)
2. Navigate to Game History
3. Select a game to replay
4. Use the slider/controls to navigate to a specific move
5. Click "Analyze Move (Beta)" button
6. View the analysis results showing:
   - Move rating (Excellent/Good/Okay/Weak)
   - Your score vs. best possible score
   - Potential point improvement
   - Details of the best move (once backend is implemented)

## Future Enhancements

- [ ] Implement backend best-move-finder API
- [ ] Add "Show Best Move" button to display tiles on board
- [ ] Show multiple alternative moves (top 3-5)
- [ ] Add batch analysis (analyze all moves in a game)
- [ ] Show move accuracy percentage per player
- [ ] Export analysis report
- [ ] Compare moves between two players
- [ ] Add difficulty settings (beginner/intermediate/expert)
- [ ] Pre-computed common patterns for faster analysis

## Performance Considerations

- Cache analysis results to avoid re-computing
- Limit search depth for faster results
- Use web workers for heavy computation
- Add progress indicator for long-running analysis
- Consider server-side caching of common positions

## References

- Scrabble AI algorithms: https://en.wikipedia.org/wiki/Scrabble#Strategy
- DAWG data structures: https://en.wikipedia.org/wiki/Deterministic_acyclic_finite_state_automaton
- Maven (strongest Scrabble AI): http://pages.cs.wisc.edu/~sheppard/papers/maven.pdf
