import { strategies } from './strategies';
import { MIN_CORPUS_WORDS } from './corpus';

const WORDS_PER_PUZZLE = 5;
const MAX_ATTEMPTS = 50;

export class OddOneOutGenerator {
    /**
     * @param words    UPPERCASE words of the chosen category
     * @param isValid  word => boolean: is the (UPPERCASE) word a real word in ANY of the selected lists? A word that
     *                 is real in another selected list must never be shown as the "invalid" one.
     */
    constructor({ words, isValid } = {}) {
        if (typeof isValid !== 'function') throw new Error('OddOneOutGenerator needs an isValid function');
        this.wordList = [...new Set(words ?? [])];
        if (this.wordList.length < MIN_CORPUS_WORDS) {
            throw new Error(`Not enough words to make a puzzle: need at least ${MIN_CORPUS_WORDS}, found ${this.wordList.length}`);
        }
        this.isValid = isValid;
    }

    generatePuzzle() {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            // 1. Pick 5 different random words
            const selection = [];
            const indices = new Set();
            while (selection.length < WORDS_PER_PUZZLE) {
                const idx = Math.floor(Math.random() * this.wordList.length);
                if (!indices.has(idx)) {
                    indices.add(idx);
                    selection.push(this.wordList[idx]);
                }
            }

            // 2. Pick a target to invalidate
            const targetIndex = Math.floor(Math.random() * WORDS_PER_PUZZLE);
            const targetWord = selection[targetIndex];

            // 3. Try the strategies in random order
            const shuffledStrategies = [...strategies].sort(() => Math.random() - 0.5);

            for (const strategy of shuffledStrategies) {
                if (!strategy.isApplicable(targetWord)) continue;
                const result = strategy.apply(targetWord);
                // 4. The new word must differ and must not be valid in ANY selected list
                if (result && result.word !== targetWord && !this.isValid(result.word)) {
                    const puzzleWords = [...selection];
                    puzzleWords[targetIndex] = result.word;

                    return {
                        words: puzzleWords,
                        correctIndex: targetIndex,
                        originalWord: targetWord,
                        explanation: `${result.explanation}. '${result.word}' is not a valid word.`,
                        strategy: strategy.name
                    };
                }
            }
        }

        throw new Error("Failed to generate puzzle after multiple attempts");
    }
}
