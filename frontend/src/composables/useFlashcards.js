import { ref, computed } from 'vue';
import {
    WORD_CATEGORIES,
    FLASHCARD_BUCKETS,
    createFlashcard,
    updateFlashcardProgress,
    getBucketStats,
    selectNextWord
} from '../data/wordCategories.js';

const STORAGE_KEY = 'scrabble-flashcards';

// Global flashcard state
const flashcardsByCategory = ref({});
const currentCategory = ref(null);
const currentFlashcard = ref(null);
const isLoading = ref(false);

export function useFlashcards() {
    // Load flashcards from localStorage
    const loadFlashcards = () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                flashcardsByCategory.value = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to load flashcards:', error);
        }
    };

    // Save flashcards to localStorage
    const saveFlashcards = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(flashcardsByCategory.value));
        } catch (error) {
            console.error('Failed to save flashcards:', error);
        }
    };

    // Initialize category with words from dictionary
    const initializeCategory = async (categoryId) => {
        isLoading.value = true;
        const category = WORD_CATEGORIES[categoryId];

        if (!category) {
            console.error('Unknown category:', categoryId);
            isLoading.value = false;
            return;
        }

        try {
            // Fetch and filter words from dictionaries using API query parameters
            const allWords = new Set();

            for (const dict of category.dictionaries) {
                // Build query string from category.apiQuery
                const queryParams = new URLSearchParams({
                    dictionary: dict,
                    ...category.apiQuery
                });

                const response = await fetch(`/api/words?${queryParams}`);
                if (response.ok) {
                    const data = await response.json();
                    const words = data.words || [];

                    // Add all words from this dictionary
                    words.forEach(word => {
                        allWords.add(word.toUpperCase());
                    });
                }
            }

            console.log(`[Flashcards] Loaded ${allWords.size} words for category: ${category.name}`);

            // Validate all words are actually in the dictionary by checking the API
            const validatedWords = new Set();
            for (const word of allWords) {
                const response = await fetch('/api/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'validate-word', word: word })
                });
                const result = await response.json();
                if (result.valid) {
                    validatedWords.add(word);
                } else {
                    console.warn(`[Flashcards] Filtered out invalid word: ${word}`);
                }
            }

            console.log(`[Flashcards] After validation: ${validatedWords.size} valid words (filtered ${allWords.size - validatedWords.size})`);

            // Create flashcards if category doesn't exist
            if (!flashcardsByCategory.value[categoryId]) {
                flashcardsByCategory.value[categoryId] = Array.from(validatedWords).map(word =>
                    createFlashcard(word, categoryId)
                );
                saveFlashcards();
            } else {
                // Validate existing flashcards and remove invalid ones
                const validWords = new Set(validatedWords);
                const existingFlashcards = flashcardsByCategory.value[categoryId];
                const validFlashcards = existingFlashcards.filter(fc => validWords.has(fc.word));
                const removedCount = existingFlashcards.length - validFlashcards.length;

                if (removedCount > 0) {
                    console.log(`[Flashcards] Removed ${removedCount} invalid words from cached data`);
                    flashcardsByCategory.value[categoryId] = validFlashcards;
                }

                // Add any new words that aren't in the existing set
                const existingWords = new Set(
                    validFlashcards.map(fc => fc.word)
                );

                const newWords = Array.from(validatedWords).filter(word => !existingWords.has(word));
                if (newWords.length > 0) {
                    flashcardsByCategory.value[categoryId].push(
                        ...newWords.map(word => createFlashcard(word, categoryId))
                    );
                    console.log(`[Flashcards] Added ${newWords.length} new words to category`);
                }

                if (removedCount > 0 || newWords.length > 0) {
                    saveFlashcards();
                }
            }

            currentCategory.value = categoryId;
        } catch (error) {
            console.error('Failed to initialize category:', error);
        } finally {
            isLoading.value = false;
        }
    };    // Get flashcards for current category
    const getFlashcards = computed(() => {
        if (!currentCategory.value) return [];
        return flashcardsByCategory.value[currentCategory.value] || [];
    });

    // Get bucket statistics
    const stats = computed(() => {
        return getBucketStats(getFlashcards.value);
    });

    // Start practice session
    const startPractice = () => {
        const flashcards = getFlashcards.value;
        const nextCard = selectNextWord(flashcards);
        currentFlashcard.value = nextCard;
        return nextCard;
    };

    // Record answer and advance to next card
    const recordAnswer = (wasCorrect) => {
        if (!currentFlashcard.value || !currentCategory.value) return;

        const categoryId = currentCategory.value;
        const flashcards = flashcardsByCategory.value[categoryId];
        const index = flashcards.findIndex(fc => fc.word === currentFlashcard.value.word);

        if (index !== -1) {
            flashcards[index] = updateFlashcardProgress(flashcards[index], wasCorrect);
            saveFlashcards();
        }

        // Move to next card
        return startPractice();
    };

    // Get category info
    const getCategoryInfo = (categoryId) => {
        return WORD_CATEGORIES[categoryId];
    };

    // Get all categories
    const getAllCategories = () => {
        return Object.values(WORD_CATEGORIES);
    };

    // Reset progress for a category
    const resetCategory = (categoryId) => {
        if (flashcardsByCategory.value[categoryId]) {
            flashcardsByCategory.value[categoryId] = flashcardsByCategory.value[categoryId].map(fc => ({
                ...fc,
                bucket: FLASHCARD_BUCKETS.NEW,
                timesCorrect: 0,
                timesIncorrect: 0,
                consecutiveCorrect: 0,
                lastPracticed: null
            }));
            saveFlashcards();
        }
    };

    // Initialize on first use
    if (Object.keys(flashcardsByCategory.value).length === 0) {
        loadFlashcards();
    }

    return {
        // State
        flashcardsByCategory,
        currentCategory,
        currentFlashcard,
        isLoading,

        // Computed
        getFlashcards,
        stats,

        // Methods
        loadFlashcards,
        saveFlashcards,
        initializeCategory,
        startPractice,
        recordAnswer,
        getCategoryInfo,
        getAllCategories,
        resetCategory,
        FLASHCARD_BUCKETS
    };
}
