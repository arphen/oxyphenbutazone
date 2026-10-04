# Language-Specific Tile Distributions

## Overview
Oxyphenbutazone supports **language-specific tile distributions** that automatically adjust based on the selected dictionary.

## Supported Languages

### 1. English (CSW21 / NWL2023)
**100 tiles total**
- **1 point**: E×12, A×9, I×9, O×8, N×6, R×6, T×6, L×4, S×4, U×4
- **2 points**: D×4, G×3
- **3 points**: B×2, C×2, M×2, P×2
- **4 points**: F×2, H×2, V×2, W×2, Y×2
- **5 points**: K×1
- **8 points**: J×1, X×1
- **10 points**: Q×1, Z×1
- **Blanks**: 2×0

### 2. Slovenian 🇸🇮
**100 tiles total** (Official Slovenian word-game distribution)
- **1 point**: E×11, A×10, I×9, O×8, N×7, R×6, S×6, J×4, L×4, T×4
- **2 points**: D×4, V×4
- **3 points**: K×3, M×2, P×2, U×2
- **4 points**: B×2, G×2, Z×2
- **5 points**: Č×1, H×1
- **6 points**: Š×1
- **8 points**: C×1
- **10 points**: F×1, Ž×1
- **Blanks**: 2×0

**Note**: Q, W, X, and Y are absent in Slovenian as they're not used in standard Slovenian.

## How It Works

### Automatic Language Detection
The game automatically determines which tile distribution to use based on your dictionary selection:

- **Slovenian tiles** 🇸🇮: Used when **only** the Slovenian dictionary is selected
- **English tiles** 🇬🇧: Used when:
  - Only CSW21 is selected
  - Only NWL2023 is selected
  - Multiple dictionaries are selected (mixed mode)

### Dictionary Selection Interface
1. Click the **📚** button in the game controls
2. Select your dictionary/dictionaries:
   - ✅ CSW21 🇬🇧 (Collins word list)
   - ✅ NWL2023 🇺🇸 (North American word list)
   - ✅ Slovenian 🇸🇮 (254,562 words)
3. See which tile set is active in the dropdown:
   - **TILES: 🇸🇮 Slovenian alphabet** - When only Slovenian is selected
   - **TILES: 🇬🇧 English alphabet** - Otherwise

### Mid-Game Behavior
- **Important**: Changing dictionaries mid-game **does NOT change the tiles already in play**
- The tile distribution only applies when starting a **new game** (Restart)
- This prevents unfair advantages from switching languages during gameplay

## Technical Implementation

### Backend (vite-plugin-game-api-v2.js)
```javascript
// Tile distributions stored as constants
const TILE_DISTRIBUTIONS = {
    english: { tiles: [...], values: {...} },
    slovenian: { tiles: [...], values: {...} }
};

// Current language tracked globally
let currentLanguage = 'english';

// Game initialization with language parameter
createInitialGameState(playerCount, language)

// Automatic language switching on dictionary change
updateActiveDictionary(selection) {
    const newLanguage = (selection.slovenian && !selection.csw21 && !selection.nwl2023) 
        ? 'slovenian' : 'english';
    // ...
}
```

### Features
✅ Dynamic tile bag generation based on language
✅ Language-specific point values
✅ Automatic language detection from dictionary selection
✅ Visual indicator showing current tile set
✅ Proper handling of Slovenian diacritics (Č, Š, Ž)
✅ Game state includes language information

## Playing in Slovenian

1. Start a new game
2. Select **only** the Slovenian dictionary 🇸🇮
3. Verify you see "TILES: 🇸🇮 Slovenian alphabet"
4. Play! The game will:
   - Use Slovenian letter distribution
   - Apply Slovenian point values
   - Validate words against 254k Slovenian words
   - Support special characters (Č, Š, Ž)

## Example Differences

### Letter J
- **English**: 1 tile, worth 8 points (rare)
- **Slovenian**: 4 tiles, worth 1 point (common)

### Letter C
- **English**: 2 tiles, worth 3 points
- **Slovenian**: 1 tile, worth 8 points (rare in Slovenian)

### Letter V
- **English**: 2 tiles, worth 4 points
- **Slovenian**: 4 tiles, worth 2 points (more common in Slovenian)

## Future Enhancements
- Add more language tile distributions (Croatian, Serbian, etc.)
- Allow custom tile distributions
- Display tile frequency chart
- Show remaining tiles by language

## Source
Slovenian distribution based on standard Slovenian word-game tile rules from Wikipedia's comprehensive tile distribution reference.
