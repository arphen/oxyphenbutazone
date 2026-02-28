# Dictionary Update Guide

## Overview
The dictionary system has been updated to support the new format with definitions and use CSW21 and NWL2023 dictionaries instead of SOWPODS and TWL.

## New Dictionary Format
The new dictionaries use the following format:
```
WORD definition [metadata]
```

Example:
```
AA rough, cindery lava [n AAS]
AB a muscle in the abdomen [n ABS]
AD an {advertisement=n} [n ADS]
```

## File Locations
Place your dictionary files in the `public` folder:
- `/public/CSW21.txt` - Collins Scrabble Words 2021
- `/public/NWL2023.txt` - NASPA Word List 2023

The old files (`sowpods.txt` and `twl.txt`) can be removed after you've placed the new ones.

## Changes Made

### 1. DictionaryChooser Component
- Changed from SOWPODS/TWL to CSW21/NWL2023
- Updated UI labels and internal state variables

### 2. Vite Plugin (vite-plugin-game-api-v2.js)
- Added `parseDictionaryFile()` function to parse the new format
- Changed from single `dictionary` Set to:
  - `csw21Dictionary` Map (word -> definition)
  - `nwl2023Dictionary` Map (word -> definition)
  - `activeDictionary` Set (combined active words for validation)
- Added `updateActiveDictionary()` function to switch between dictionaries
- Added support for 'update-dictionary' action

### 3. GameBoard-v2.vue
- Updated default dictionary selection from `{ sowpods: true, twl: false }` to `{ csw21: true, nwl2023: false }`
- Updated validation in `handleDictionaryUpdate()` method

### 4. FreePlay.vue
- Updated dictionary loading to parse new format
- Changed from Sets to Maps for storing definitions
- Updated `updateActiveDictionary()` to work with new structure
- Updated validation in `handleDictionaryUpdate()` method

## Dictionary Parsing
The parser:
1. Reads each line from the dictionary file
2. Splits on first whitespace: `WORD` and `definition [metadata]`
3. Stores the word (uppercase) as key and full definition as value
4. For word validation, only the word keys are used (case-insensitive)

## Future Enhancements
The dictionary Maps now store definitions, which could be used to:
- Display word definitions when hovering over played words
- Show definition tooltips in the UI
- Add a dictionary lookup feature
- Display definitions in game history

## Testing
To test the implementation:
1. Place CSW21.txt and NWL2023.txt in the `/public` folder
2. Start the dev server: `npm run dev`
3. Check the console for dictionary loading messages
4. Try playing words and verify validation works
5. Toggle between dictionaries using the 📚 button
6. Verify words valid in one dictionary but not the other behave correctly
