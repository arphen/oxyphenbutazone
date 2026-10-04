# Dictionaries

## Format & Setup

Place dictionary files in `public/` with one word per line. Each line is either:

```
WORD
WORD definition [metadata]
```

Examples:
```
AA
AA rough, cindery lava [n AAS]
QUIZ to test the knowledge of by asking questions [v QUIZZED, QUIZZING, QUIZZES]
```

The definition and metadata are optional but recommended for the word definition tooltip feature.

## Available Dictionaries

Place the following files in `public/`:

| File | Words | Region | Notes |
|------|-------|--------|-------|
| **CSW21.txt** | 352k+ | International | Collins Scrabble Words 2021 |
| **NWL2023.txt** | 184k+ | North America | NASPA Word List 2023 |
| **SLOVENIAN.txt** | 254k+ | Slovenia | Includes Č, Š, Ž |

Alternatively, set only the dictionaries you need; the game will load whichever files exist.

## Updating Dictionaries

1. Download or create your dictionary file
2. Ensure format is one word per line (definition optional)
3. Place in `public/` with the matching filename
4. Restart the dev server
5. Check console for "Dictionary loaded: X words"

If dictionaries are not found at startup, the game will log warnings and use only available dictionaries.

## Testing Dictionary Changes

1. Start dev server: `cd frontend && npm run dev`
2. Check console for dictionary load messages:
   ```
   [Game API] CSW21 Dictionary loaded: 352123 words
   [Game API] NWL2023 Dictionary loaded: 184567 words
   [Game API] Active dictionary updated: 352123 words
   ```
3. Click the 📚 button in game controls to toggle dictionaries
4. Play a word and hover over it in Game History to see its definition
5. Test invalid words (they show "Not in dictionary")

## In-Game Dictionary Selection

Players can switch active dictionaries via the 📚 button:

- **Single dictionary** (CSW21 only): Only CSW21 words are valid
- **Multiple dictionaries** (CSW21 + NWL2023): Word is valid if in either
- **Slovenian only**: Uses Slovenian dictionary and Slovenian tile distribution

Changing dictionaries does NOT affect the current game (only applies to the next restart).

## Backend Implementation

The `vite-plugin-game-api-v2.js` plugin:

1. **Loads** dictionaries on server startup into Maps: `csw21Dictionary`, `nwl2023Dictionary`, `slovenianDictionary`
2. **Parses** each line: word (key) → definition (value)
3. **Combines** selected dictionaries into `activeDictionary` (Set) for validation
4. **Returns** definitions in `handlePlayWord()` and via `getDefinition(word)`
5. **Filters** word lists on `GET /api/words?dictionary=csw21|nwl2023|slovenian` with params like `?length=`, `?contains=`, `?startsWith=`, etc.

## Troubleshooting

**Definitions not showing?**
- Verify CSW21.txt and NWL2023.txt exist in `/public/`
- Check console for load messages
- Ensure format is `WORD definition [metadata]`
- Hard refresh browser cache

**Words not validating?**
- Ensure at least one dictionary is selected (📚 button)
- Check that the word exists in the selected dictionary
- Look at console for validation messages

**Dictionary load fails silently?**
- Check that files are named exactly `CSW21.txt`, `NWL2023.txt`, `SLOVENIAN.txt`
- Verify file paths: `public/CSW21.txt` (relative to frontend root)
- Check server console for error messages

## Word Definition Examples

When hovering over a played word in Game History:

**Valid word (CSW21):**
```
CAT
a carnivorous mammal [n CATS]
```

**Invalid word (not in any dictionary):**
```
XYZABC
Not in dictionary
```

**Word with alternate forms:**
```
QUIZ
to test the knowledge of by asking questions [v QUIZZED, QUIZZING, QUIZZES]
```
