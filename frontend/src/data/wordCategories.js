// Word categories for flashcard practice system
// Each category has filtering criteria and associated dictionary

export const WORD_CATEGORIES = {
    'three-letter-v': {
        id: 'three-letter-v',
        name: '3-Letter Words with V',
        description: 'All three-letter words containing the letter V',
        dictionaries: ['csw21', 'nwl2023'], // Which dictionaries to pull from
        apiQuery: {
            length: 3,
            contains: 'V'
        },
        difficulty: 'beginner',
        icon: '✌️'
    },
    'three-letter-q': {
        id: 'three-letter-q',
        name: '3-Letter Words with Q',
        description: 'All three-letter words containing the letter Q',
        dictionaries: ['csw21', 'nwl2023'],
        apiQuery: {
            length: 3,
            contains: 'Q'
        },
        difficulty: 'advanced',
        icon: '👑'
    },
    'three-letter-j': {
        id: 'three-letter-j',
        name: '3-Letter Words with J',
        description: 'All three-letter words containing the letter J',
        dictionaries: ['csw21', 'nwl2023'],
        apiQuery: {
            length: 3,
            contains: 'J'
        },
        difficulty: 'intermediate',
        icon: '🎯'
    },
    'two-letter-all': {
        id: 'two-letter-all',
        name: 'All 2-Letter Words',
        description: 'Master all valid 2-letter words',
        dictionaries: ['csw21', 'nwl2023'],
        apiQuery: {
            length: 2
        },
        difficulty: 'beginner',
        icon: '🔤'
    },
    'q-without-u': {
        id: 'q-without-u',
        name: 'Q without U',
        description: 'Words with Q but no U',
        dictionaries: ['csw21', 'nwl2023'],
        apiQuery: {
            contains: 'Q',
            excludes: 'U'
        },
        difficulty: 'expert',
        icon: '🎓'
    },
    'three-letter-x': {
        id: 'three-letter-x',
        name: '3-Letter Words with X',
        description: 'All three-letter words containing the letter X',
        dictionaries: ['csw21', 'nwl2023'],
        apiQuery: {
            length: 3,
            contains: 'X'
        },
        difficulty: 'intermediate',
        icon: '❌'
    },
    'three-letter-z': {
        id: 'three-letter-z',
        name: '3-Letter Words with Z',
        description: 'All three-letter words containing the letter Z',
        dictionaries: ['csw21', 'nwl2023'],
        apiQuery: {
            length: 3,
            contains: 'Z'
        },
        difficulty: 'intermediate',
        icon: '⚡'
    },
    'four-letter-high-value': {
        id: 'four-letter-high-value',
        name: '4-Letter High Value',
        description: '4-letter words with J, Q, X, or Z',
        dictionaries: ['csw21', 'nwl2023'],
        apiQuery: {
            length: 4,
            containsAny: 'J,Q,X,Z' // Contains at least one of these
        },
        difficulty: 'advanced',
        icon: '💎'
    }
};// Flashcard bucket system for spaced repetition
export const FLASHCARD_BUCKETS = {
    NEW: 'new',           // Haven't seen yet
    LEARNING: 'learning', // Seen 1-2 times, still learning
    REVIEWING: 'reviewing', // Seen 3+ times, needs review
    MASTERED: 'mastered'  // Consistently correct
};

// Default flashcard state for a word
export function createFlashcard(word, category) {
    return {
        word: word.toUpperCase(),
        category,
        bucket: FLASHCARD_BUCKETS.NEW,
        timesCorrect: 0,
        timesIncorrect: 0,
        lastPracticed: null,
        dateAdded: new Date().toISOString(),
        consecutiveCorrect: 0
    };
}

// Progress a flashcard based on correctness
export function updateFlashcardProgress(flashcard, wasCorrect) {
    const updated = { ...flashcard };
    updated.lastPracticed = new Date().toISOString();

    if (wasCorrect) {
        updated.timesCorrect++;
        updated.consecutiveCorrect++;

        // Advance bucket based on consecutive correct answers
        if (updated.consecutiveCorrect >= 5 && updated.bucket !== FLASHCARD_BUCKETS.MASTERED) {
            updated.bucket = FLASHCARD_BUCKETS.MASTERED;
        } else if (updated.consecutiveCorrect >= 3 && updated.bucket === FLASHCARD_BUCKETS.LEARNING) {
            updated.bucket = FLASHCARD_BUCKETS.REVIEWING;
        } else if (updated.consecutiveCorrect >= 1 && updated.bucket === FLASHCARD_BUCKETS.NEW) {
            updated.bucket = FLASHCARD_BUCKETS.LEARNING;
        }
    } else {
        updated.timesIncorrect++;
        updated.consecutiveCorrect = 0;

        // Demote bucket on incorrect answer
        if (updated.bucket === FLASHCARD_BUCKETS.MASTERED) {
            updated.bucket = FLASHCARD_BUCKETS.REVIEWING;
        } else if (updated.bucket === FLASHCARD_BUCKETS.REVIEWING) {
            updated.bucket = FLASHCARD_BUCKETS.LEARNING;
        }
    }

    return updated;
}

// Get bucket statistics for a category
export function getBucketStats(flashcards) {
    const stats = {
        [FLASHCARD_BUCKETS.NEW]: 0,
        [FLASHCARD_BUCKETS.LEARNING]: 0,
        [FLASHCARD_BUCKETS.REVIEWING]: 0,
        [FLASHCARD_BUCKETS.MASTERED]: 0,
        total: flashcards.length
    };

    flashcards.forEach(card => {
        stats[card.bucket]++;
    });

    return stats;
}

// Select next word to practice (prioritize learning over mastered)
export function selectNextWord(flashcards) {
    if (!flashcards || flashcards.length === 0) return null;

    // Priority: NEW > LEARNING > REVIEWING > MASTERED
    const priorities = [
        FLASHCARD_BUCKETS.NEW,
        FLASHCARD_BUCKETS.LEARNING,
        FLASHCARD_BUCKETS.REVIEWING,
        FLASHCARD_BUCKETS.MASTERED
    ];

    for (const bucket of priorities) {
        const cardsInBucket = flashcards.filter(card => card.bucket === bucket);
        if (cardsInBucket.length > 0) {
            // Randomly select from this bucket
            return cardsInBucket[Math.floor(Math.random() * cardsInBucket.length)];
        }
    }

    return null;
}
