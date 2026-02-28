# Word Definitions Feature

## Overview
Words played in the game now display their definitions when you hover over them in the game history table on the laptop view.

## Features Implemented

### 1. Backend (vite-plugin-game-api-v2.js)
- **`getDefinition(word)`** - New function that looks up word definitions from active dictionaries
  - Checks CSW21 dictionary first
  - Falls back to NWL2023 dictionary
  - Returns null if not found in either
  
- **Enhanced `handlePlayWord()`** - Now includes definitions in word history
  - Each word in `wordScores` now has: `{ word, score, definition }`
  - Valid words get their definitions from the active dictionaries
  - Invalid words get "Not in dictionary" as their definition

### 2. Frontend (GameBoard-v2.vue)

#### HTML Changes
- Words in the history table are now wrapped in `<span class="word-with-definition">` elements
- Each word has its definition in the `title` attribute for tooltip display
- Works for both valid and invalid words

#### Visual Design
- **Hover indicator**: Dotted blue underline appears when hovering
- **Tooltip**: Definition appears in a styled popup below the word
- **Smooth animations**: Fade-in effect for tooltips
- **Professional styling**: Dark themed with blur effects and borders

## User Experience

### How It Works
1. Play a word in the game
2. The word appears in the Game History table
3. Hover over any word to see its definition
4. The definition includes:
   - Word meaning
   - Part of speech
   - Plural/verb forms in brackets

### Example
Hovering over "QUIZ" might show:
```
to test the knowledge of by asking questions [v QUIZZED, QUIZZING, QUIZZES]
```

## Technical Details

### Definition Format
The dictionaries use this format:
```
WORD definition text [metadata]
```

Example entries:
```
AA rough, cindery lava [n AAS]
QUIZ to test the knowledge of by asking questions [v QUIZZED, QUIZZING, QUIZZES]
```

### Tooltip Styling Features
- **Position**: Appears directly below the word
- **Arrow**: Small arrow pointing to the word
- **Max width**: 300px for readability
- **Background**: Semi-transparent dark blue with blur effect
- **Border**: Subtle blue glow
- **Animation**: Smooth fade-in (0.2s)

## Browser Compatibility
- Works in all modern browsers
- Uses CSS tooltips with `::after` pseudo-elements
- Fallback: Default browser title tooltips if CSS fails

## Performance
- Definitions are fetched once during word validation
- No additional API calls needed for tooltip display
- Lightweight implementation using native CSS tooltips

## Future Enhancements
Possible additions:
- Click to "pin" definition (keep it visible)
- Search/filter words by definition
- Export game with definitions
- Show definitions in game replay mode
- Mobile-friendly tap-to-view definitions
