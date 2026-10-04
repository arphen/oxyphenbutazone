import { describe, it, expect, afterEach, vi } from 'vitest';
import { OddOneOutGenerator } from './generator.js';
import { strategies } from './strategies.js';

// Math.random replaced by a fixed sequence, then a constant once the sequence runs out
const stubRandom = (sequence, rest) => {
  let i = 0;
  vi.spyOn(Math, 'random').mockImplementation(() => (i < sequence.length ? sequence[i++] : rest));
};
// A seeded linear congruential generator
const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

afterEach(() => vi.restoreAllMocks());

const WORDS = ['CAT', 'DOG', 'EMU', 'FOX', 'HEN'];
const VOWELS = 'AEIOU';

describe('OddOneOutGenerator construction', () => {
  it('throws a clear error with fewer than 5 words', () => {
    expect(() => new OddOneOutGenerator({ words: ['CAT', 'DOG', 'EMU', 'FOX'], isValid: () => false })).toThrow(
      'Not enough words to make a puzzle: need at least 5, found 4'
    );
    expect(() => new OddOneOutGenerator({ words: [], isValid: () => false })).toThrow(/found 0/);
  });

  it('counts distinct words only', () => {
    expect(() => new OddOneOutGenerator({ words: ['CAT', 'CAT', 'DOG', 'EMU', 'FOX'], isValid: () => false })).toThrow(/found 4/);
  });

  it('needs an isValid function', () => {
    expect(() => new OddOneOutGenerator({ words: WORDS })).toThrow(/isValid/);
  });

  it('accepts exactly 5 words', () => {
    expect(() => new OddOneOutGenerator({ words: WORDS, isValid: () => false })).not.toThrow();
  });
});

describe('generatePuzzle', () => {
  it('has the shape the views use, for many seeds', () => {
    const words = ['QI', 'QAT', 'FAQIR', 'TRANQ', 'QOPH', 'NIQAB', 'QADI', 'UMIAQ'];
    const valid = new Set(words);
    const generator = new OddOneOutGenerator({ words, isValid: (w) => valid.has(w) });
    for (let seed = 1; seed <= 200; seed++) {
      vi.spyOn(Math, 'random').mockImplementation(seeded(seed));
      const puzzle = generator.generatePuzzle();
      vi.restoreAllMocks();

      expect(Object.keys(puzzle).sort()).toEqual(['correctIndex', 'explanation', 'originalWord', 'strategy', 'words']);
      expect(puzzle.words).toHaveLength(5);
      expect(Number.isInteger(puzzle.correctIndex) && puzzle.correctIndex >= 0 && puzzle.correctIndex < 5).toBe(true);
      const odd = puzzle.words[puzzle.correctIndex];
      expect(valid.has(odd)).toBe(false); // the odd one is not a real word
      expect(valid.has(puzzle.originalWord)).toBe(true);
      expect(odd).not.toBe(puzzle.originalWord);
      expect(odd).toHaveLength(puzzle.originalWord.length);
      const others = puzzle.words.filter((_, i) => i !== puzzle.correctIndex);
      expect(others.every((w) => valid.has(w))).toBe(true); // the other four are real words...
      expect(new Set(puzzle.words).size).toBe(5); // ...and all five differ
      expect(['VowelSwap', 'ConsonantSwap']).toContain(puzzle.strategy);
      expect(puzzle.explanation.endsWith(`'${odd}' is not a valid word.`)).toBe(true);
    }
  });

  it('with a known random sequence: EMU becomes EZU when EMO is a real word in another list', () => {
    // 0, .2, .4, .6, .8 pick words 0..4 (CAT DOG EMU FOX HEN); .5 picks target index floor(.5*5) = 2 (EMU).
    // Afterwards random is .99: VowelSwap would change the U (vowel #1 of 2) to the last of A,E,I,O = O -> EMO;
    // ConsonantSwap changes M (the only consonant) to the last of the 20 other consonants = Z -> EZU.
    stubRandom([0, 0.2, 0.4, 0.6, 0.8, 0.5], 0.99);
    const validEverywhere = new Set([...WORDS, 'EMO']); // EMO is a word in the "other" list
    const generator = new OddOneOutGenerator({ words: WORDS, isValid: (w) => validEverywhere.has(w) });
    const puzzle = generator.generatePuzzle();
    expect(puzzle).toEqual({
      words: ['CAT', 'DOG', 'EZU', 'FOX', 'HEN'],
      correctIndex: 2,
      originalWord: 'EMU',
      explanation: "Replaced consonant M with Z. 'EZU' is not a valid word.",
      strategy: 'ConsonantSwap'
    });
  });

  it('with the same sequence: EMU becomes EMO when EZU is the real word', () => {
    stubRandom([0, 0.2, 0.4, 0.6, 0.8, 0.5], 0.99);
    const generator = new OddOneOutGenerator({ words: WORDS, isValid: (w) => WORDS.includes(w) || w === 'EZU' });
    expect(generator.generatePuzzle()).toEqual({
      words: ['CAT', 'DOG', 'EMO', 'FOX', 'HEN'],
      correctIndex: 2,
      originalWord: 'EMU',
      explanation: "Replaced vowel U with O. 'EMO' is not a valid word.",
      strategy: 'VowelSwap'
    });
  });

  it('never shows a word that isValid accepts, even one that only another list knows', () => {
    // Pretend another list contains every vowel variation of our words (same consonants, any vowels)
    const skeleton = (w) => [...w].map((c) => (VOWELS.includes(c) ? '*' : c)).join('');
    const skeletons = new Set(WORDS.map(skeleton));
    const isValid = (w) => skeletons.has(skeleton(w));
    const generator = new OddOneOutGenerator({ words: WORDS, isValid });
    for (let seed = 1; seed <= 100; seed++) {
      vi.spyOn(Math, 'random').mockImplementation(seeded(seed));
      const puzzle = generator.generatePuzzle();
      vi.restoreAllMocks();
      expect(isValid(puzzle.words[puzzle.correctIndex])).toBe(false);
      expect(puzzle.strategy).toBe('ConsonantSwap'); // every vowel swap lands on a "real" word and is refused
    }
  });

  it('gives up with a clear error when every alteration is a real word', () => {
    const generator = new OddOneOutGenerator({ words: WORDS, isValid: () => true });
    expect(() => generator.generatePuzzle()).toThrow('Failed to generate puzzle after multiple attempts');
  });
});

describe('strategies', () => {
  afterEach(() => vi.restoreAllMocks());
  const byName = (name) => strategies.find((s) => s.name === name);

  it('VowelSwap changes exactly one vowel to another vowel', () => {
    stubRandom([], 0); // first vowel, first other vowel
    expect(byName('VowelSwap').apply('EMU')).toEqual({ word: 'AMU', explanation: 'Replaced vowel E with A' });
    vi.restoreAllMocks();
    stubRandom([], 0.99); // last vowel, last other vowel
    expect(byName('VowelSwap').apply('EMU')).toEqual({ word: 'EMO', explanation: 'Replaced vowel U with O' });
  });

  it('ConsonantSwap prefers the sound-alike (M -> N) and otherwise any other consonant', () => {
    stubRandom([], 0); // 0 is not > 0.7: keep the sound-alike
    expect(byName('ConsonantSwap').apply('EMU')).toEqual({ word: 'ENU', explanation: 'Replaced consonant M with N' });
    vi.restoreAllMocks();
    stubRandom([], 0.99); // > 0.7: any consonant, here the last (Z)
    expect(byName('ConsonantSwap').apply('EMU')).toEqual({ word: 'EZU', explanation: 'Replaced consonant M with Z' });
  });

  it('every strategy changes a word into a different word of the same length, for many seeds', () => {
    const samples = ['QI', 'QAT', 'FAQIR', 'JINX', 'VEXED', 'ZZZ', 'TRANQ'];
    for (let seed = 1; seed <= 50; seed++) {
      vi.spyOn(Math, 'random').mockImplementation(seeded(seed));
      for (const strategy of strategies) {
        for (const word of samples) {
          if (!strategy.isApplicable(word)) continue;
          const { word: changed } = strategy.apply(word);
          const differing = [...word].filter((c, i) => c !== changed[i]).length;
          expect(changed).toHaveLength(word.length);
          expect(differing).toBe(1);
        }
      }
      vi.restoreAllMocks();
    }
  });

  it('is only applicable to words that have the letter kind it swaps', () => {
    expect(byName('VowelSwap').isApplicable('RHYTHM')).toBe(false);
    expect(byName('VowelSwap').apply('RHYTHM')).toBeNull();
    expect(byName('ConsonantSwap').isApplicable('AEIOU')).toBe(false);
    expect(byName('ConsonantSwap').apply('AEIOU')).toBeNull();
    expect(byName('VowelSwap').isApplicable('QI')).toBe(true);
    expect([...'QAT'].some((c) => VOWELS.includes(c))).toBe(true);
  });
});
