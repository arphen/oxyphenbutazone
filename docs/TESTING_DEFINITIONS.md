# Testing the Word Definitions Feature

## Quick Test Guide

### 1. Start the Dev Server
```bash
cd /Users/swozny/Projects/oxyphenbutazone/frontend
npm run dev
```

### 2. Make Sure Dictionaries Are Loaded
Check the terminal output for:
```
[Game API] CSW21 Dictionary loaded: XXXXX words
[Game API] NWL2023 Dictionary loaded: XXXXX words
[Game API] Active dictionary updated: XXXXX words
```

### 3. Play Some Words
Navigate to the game board and play a few words. Try:
- Short words: "CAT", "DOG", "AT"
- Longer words: "QUIZ", "JAZZ", "FIZZ"
- Invalid words (to test error tooltips)

### 4. View Definitions
- Look at the Game History table on the right sidebar
- Hover your mouse over any word in the history
- A tooltip should appear showing:
  - The word's definition
  - Part of speech
  - Word forms (plurals, verb tenses, etc.)

## Expected Behavior

### Valid Words
When you hover over "QUIZ" in the history:
```
╔═══════════════════════════════════════╗
║ QUIZ ← (word is underlined in blue)   ║
║   ↓                                    ║
║ ┌─────────────────────────────────┐   ║
║ │ to test the knowledge of by     │   ║
║ │ asking questions                │   ║
║ │ [v QUIZZED, QUIZZING, QUIZZES]  │   ║
║ └─────────────────────────────────┘   ║
╚═══════════════════════════════════════╝
```

### Invalid Words
When you hover over an invalid word:
```
╔═══════════════════════════════════════╗
║ ❌ XYZABC ← (red X, dotted underline) ║
║   ↓                                    ║
║ ┌─────────────────────────────────┐   ║
║ │ Not in dictionary                │   ║
║ └─────────────────────────────────┘   ║
╚═══════════════════════════════════════╝
```

## Troubleshooting

### Definitions Not Showing?
1. **Check dictionaries are loaded**: Look for CSW21.txt and NWL2023.txt in `/public/` folder
2. **Check console**: Open browser DevTools and look for dictionary loading messages
3. **Clear cache**: Hard refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
4. **Check format**: Make sure dictionary files follow the format:
   ```
   WORD definition text [metadata]
   ```

### Tooltips Look Wrong?
- Try zooming in/out in your browser
- Check if browser extensions are interfering with CSS
- Make sure you're using a modern browser (Chrome, Firefox, Safari, Edge)

### Words Not Validating?
- Ensure at least one dictionary is selected (CSW21 or NWL2023)
- Check that words are spelled correctly (all uppercase in history)
- Look at the console for validation messages

## Visual Indicators

### Before Hover
```
Rnd | Player | Words      | Score
----|--------|------------|------
 1  | P1     | CAT, DOG   | +12
                ^^^  ^^^
         (dotted underlines)
```

### During Hover (on "CAT")
```
Rnd | Player | Words      | Score
----|--------|------------|------
 1  | P1     | CAT, DOG   | +12
              ^^^
              └─────────────────┐
              │ a carnivorous    │
              │ mammal           │
              │ [n CATS]         │
              └──────────────────┘
```

## Code Changes Summary

### Files Modified
1. **vite-plugin-game-api-v2.js**
   - Added `getDefinition()` function
   - Updated `handlePlayWord()` to include definitions
   - Updated invalid word handling to include definitions

2. **GameBoard-v2.vue**
   - Modified words-cell template to use word objects
   - Added `.word-with-definition` class wrapper
   - Added tooltip styling with animations
   - Enhanced hover states

### Data Structure
Before:
```javascript
words: [{ word: "CAT", score: 5 }]
```

After:
```javascript
words: [{ 
  word: "CAT", 
  score: 5, 
  definition: "a carnivorous mammal [n CATS]" 
}]
```

## Next Steps
- Test with various words
- Try both dictionaries (CSW21 and NWL2023)
- Check mobile view (may need separate implementation)
- Consider adding click-to-pin functionality for definitions
