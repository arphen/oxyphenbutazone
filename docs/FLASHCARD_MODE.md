# Word Practice / Flashcard Mode 📚

## Overview
A game mode that helps players learn and master words using a **Karteikarten (flashcard)** system with spaced repetition.

## Features

### 1. Word Categories
Pre-defined categories to practice specific word groups:
- **3-Letter Words with V** ✌️ (Beginner)
- **3-Letter Words with Q** 👑 (Advanced)
- **3-Letter Words with J** 🎯 (Intermediate)
- **All 2-Letter Words** 🔤 (Beginner)
- **Q without U** 🎓 (Expert)

Each category filters words from the selected dictionaries (CSW21, NWL2023, Slovenian).

### 2. Spaced Repetition Buckets
Words are organized into 4 buckets based on your mastery:

| Bucket | Icon | Description | Progression |
|--------|------|-------------|-------------|
| **New** | 🆕 | Words you haven't seen yet | 0 correct answers |
| **Learning** | 📖 | Words you're actively learning | 1-2 consecutive correct |
| **Reviewing** | 🔄 | Words needing periodic review | 3-4 consecutive correct |
| **Mastered** | ⭐ | Words you know well | 5+ consecutive correct |

### 3. Practice Scenarios
Each word is presented with different board scenarios:

- **Simple**: Empty board, play through center
- **Hook**: Add letters to existing words
- **Parallel**: Play parallel to another word
- **Extension**: Extend existing words
- **Premium**: Maximize points with premium squares

### 4. Progress Tracking
- Visual bucket statistics showing word distribution
- Progress bar showing mastery percentage
- Individual card statistics (✅ correct, ❌ incorrect, 🔥 streak)
- Automatic bucket promotion/demotion based on performance

### 5. UI Features
- **7x7 mini board preview** showing the practice scenario
- **Word reveal** option to see the target word
- **Full board practice** button to play the scenario on the full game board
- **Self-assessment** buttons (Got It Right / Need More Practice)
- **Progress reset** option per category
- **LocalStorage persistence** - progress saved automatically

## How It Works

### Category Initialization
1. Select a category from the home screen
2. System fetches all words from selected dictionaries
3. Filters words based on category criteria (length, contains specific letter, etc.)
4. Creates flashcards for each word (all start in "New" bucket)
5. Stores flashcards in localStorage

### Practice Flow
1. Click "Start Practice" 
2. System selects next word (prioritizes: New > Learning > Reviewing > Mastered)
3. Shows mini board with practice scenario
4. Option to reveal word or try to figure it out
5. Self-assess: "Got It Right" or "Need More Practice"
6. Card advances/demotes based on answer
7. Repeat until all words reviewed

### Bucket Progression Rules
- **New → Learning**: 1 consecutive correct answer
- **Learning → Reviewing**: 3 consecutive correct answers
- **Reviewing → Mastered**: 5 consecutive correct answers
- **Any bucket ← Demotion**: Incorrect answer moves back one bucket

## Technical Architecture

### Files Created
```
frontend/src/
├── data/
│   ├── wordCategories.js       # Category definitions, bucket system, progression logic
│   └── scenarioGenerator.js    # Board scenario generation
├── composables/
│   └── useFlashcards.js        # Vue composable for state management
└── views/
    └── FlashcardPractice.vue   # Main UI component
```

### Backend API
New endpoint added to `vite-plugin-game-api-v2.js`:
```
GET /api/words?dictionary=csw21|nwl2023|slovenian
Returns: { words: string[], count: number }
```

### Data Flow
1. **Category Selection** → Fetch words from API → Filter by category criteria
2. **Create Flashcards** → Store in localStorage with bucket metadata
3. **Practice Session** → Select next word → Generate scenario → Show UI
4. **Record Answer** → Update bucket → Save to localStorage → Next word

## Usage Example

```javascript
// Initialize flashcard system
import { useFlashcards } from '@/composables/useFlashcards.js';

const {
  initializeCategory,
  startPractice,
  recordAnswer,
  stats
} = useFlashcards();

// Load a category
await initializeCategory('three-letter-v');

// Start practice
const currentCard = startPractice();
// currentCard = { word: 'VAN', category: 'three-letter-v', bucket: 'new', ... }

// After user answers
const nextCard = recordAnswer(wasCorrect); // true or false
```

## Future Enhancements
- [ ] More categories (4-letter words, vowel dumps, high-point words)
- [ ] Custom categories (user-defined word lists)
- [ ] Daily practice goals
- [ ] Statistics dashboard
- [ ] Export/import flashcard progress
- [ ] Multi-language support for Slovenian words
- [ ] Anki-style spaced repetition algorithm
- [ ] Challenge mode with time limits

## Navigation
Access via:
- Home screen → "Word Practice" card
- Direct URL: `/flashcards`
