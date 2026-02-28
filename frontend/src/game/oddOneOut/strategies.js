// Strategies for invalidating words

const VOWELS = 'AEIOU';
const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ';

export const strategies = [
    {
        name: 'VowelSwap',
        description: 'Swaps a vowel for another vowel',
        isApplicable(word) {
            return [...word].some(char => VOWELS.includes(char));
        },
        apply(word) {
            const vowelIndices = [...word].map((c, i) => VOWELS.includes(c) ? i : -1).filter(i => i !== -1);
            if (vowelIndices.length === 0) return null;

            const targetIndex = vowelIndices[Math.floor(Math.random() * vowelIndices.length)];
            const originalChar = word[targetIndex];

            const otherVowels = [...VOWELS].filter(v => v !== originalChar);
            const newChar = otherVowels[Math.floor(Math.random() * otherVowels.length)];

            return {
                word: word.substring(0, targetIndex) + newChar + word.substring(targetIndex + 1),
                explanation: `Replaced vowel ${originalChar} with ${newChar}`
            };
        }
    },
    {
        name: 'ConsonantSwap',
        description: 'Swaps a consonant for another consonant',
        isApplicable(word) {
            return [...word].some(char => CONSONANTS.includes(char));
        },
        apply(word) {
            const consIndices = [...word].map((c, i) => CONSONANTS.includes(c) ? i : -1).filter(i => i !== -1);
            if (consIndices.length === 0) return null;

            const targetIndex = consIndices[Math.floor(Math.random() * consIndices.length)];
            const originalChar = word[targetIndex];

            // Prefer similar sounding swaps if possible, otherwise random
            const pairs = {
                'B': ['P'], 'P': ['B'],
                'D': ['T'], 'T': ['D'],
                'G': ['K'], 'K': ['G'],
                'F': ['V'], 'V': ['F'],
                'S': ['Z'], 'Z': ['S'],
                'M': ['N'], 'N': ['M']
            };

            let candidates = pairs[originalChar] || [];
            if (candidates.length === 0 || Math.random() > 0.7) {
                // 30% chance to pick completely random consonant, or if no pair exists
                candidates = [...CONSONANTS].filter(c => c !== originalChar);
            }

            const newChar = candidates[Math.floor(Math.random() * candidates.length)];

            return {
                word: word.substring(0, targetIndex) + newChar + word.substring(targetIndex + 1),
                explanation: `Replaced consonant ${originalChar} with ${newChar}`
            };
        }
    }
];
