import { strategies } from './strategies';

export class OddOneOutGenerator {
    constructor(corpus, validDictionaries = ['CSW21', 'NWL2023']) {
        // corpus is { word: [dict1, dict2] }
        this.corpus = corpus;
        this.validDictionaries = validDictionaries;

        // Create a Set of all valid words for the selected dictionaries
        this.validWords = new Set();
        this.wordList = [];

        for (const [word, dicts] of Object.entries(corpus)) {
            if (dicts.some(d => validDictionaries.includes(d))) {
                this.validWords.add(word);
                this.wordList.push(word);
            }
        }
    }

    generatePuzzle() {
        if (this.wordList.length < 5) {
            throw new Error("Not enough words in corpus to generate puzzle");
        }

        // Try up to 10 times to generate a valid puzzle
        for (let attempt = 0; attempt < 10; attempt++) {
            // 1. Pick 5 random words
            const selection = [];
            const indices = new Set();
            while (selection.length < 5) {
                const idx = Math.floor(Math.random() * this.wordList.length);
                if (!indices.has(idx)) {
                    indices.add(idx);
                    selection.push(this.wordList[idx]);
                }
            }

            // 2. Pick a target to invalidate
            const targetIndex = Math.floor(Math.random() * 5);
            const targetWord = selection[targetIndex];

            // 3. Try to apply strategies
            // Shuffle strategies to be dynamic
            const shuffledStrategies = [...strategies].sort(() => Math.random() - 0.5);

            for (const strategy of shuffledStrategies) {
                if (strategy.isApplicable(targetWord)) {
                    const result = strategy.apply(targetWord);

                    if (result) {
                        // 4. Verify the new word is NOT in the valid set
                        if (!this.validWords.has(result.word)) {
                            // Success!
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
            }
        }

        throw new Error("Failed to generate puzzle after multiple attempts");
    }
}
