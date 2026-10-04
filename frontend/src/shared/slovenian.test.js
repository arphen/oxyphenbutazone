import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as R from './rules.js';

const dictionaryPath = fileURLToPath(new URL('../../public/SLOVENIAN.txt', import.meta.url));
const words = readFileSync(dictionaryPath, 'utf-8').split('\n').filter(Boolean);
const wordSet = new Set(words);

describe('alphabets', () => {
  it('each alphabet is exactly the set of non-blank letters in its tile distribution', () => {
    for (const language of Object.keys(R.TILE_DISTRIBUTIONS)) {
      const fromTiles = R.getDistribution(language)
        .tiles.map((t) => t.letter)
        .filter(Boolean)
        .sort();
      expect([...R.getAlphabet(language)].sort()).toEqual(fromTiles);
    }
  });

  it('every tile letter has a point value', () => {
    for (const language of Object.keys(R.TILE_DISTRIBUTIONS)) {
      for (const letter of R.getAlphabet(language)) {
        expect(R.getDistribution(language).values).toHaveProperty(letter);
      }
    }
  });

  it('slovenian has č š ž and none of q w x y; english has all 26 letters', () => {
    const sl = R.getAlphabet('slovenian');
    for (const l of ['č', 'š', 'ž']) expect(sl).toContain(l);
    for (const l of ['q', 'w', 'x', 'y']) expect(sl).not.toContain(l);
    expect(R.getAlphabet('english')).toHaveLength(26);
  });

  it('slovenian bag has 100 tiles including 2 blanks and one each of č š ž', () => {
    const bag = R.createTileBag('slovenian');
    expect(bag).toHaveLength(100);
    expect(bag.filter((t) => t === '')).toHaveLength(2);
    for (const l of ['č', 'š', 'ž']) expect(bag.filter((t) => t === l)).toHaveLength(1);
  });

  it('unknown languages fall back to english', () => {
    expect(R.getAlphabet('klingon')).toEqual(R.getAlphabet('english'));
  });
});

describe('SLOVENIAN.txt', () => {
  it('contains real words with č š ž (guards against the old ISO-8859-2/Latin-1 corruption)', () => {
    for (const w of ['šola', 'čaj', 'žoga', 'življenje', 'črka', 'ščiti', 'kača', 'hiša', 'že', 'če', 'še']) {
      expect(wordSet.has(w), w).toBe(true);
    }
  });

  it('has no mojibake characters', () => {
    expect(words.filter((w) => /[¹¾è©®æ]/.test(w))).toEqual([]);
  });

  it('every entry is playable: lowercase, 2-15 letters, tile alphabet only', () => {
    const alphabet = new Set(R.getAlphabet('slovenian'));
    const bad = words.filter(
      (w) => w.length < 2 || w.length > 15 || [...w].some((ch) => !alphabet.has(ch))
    );
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('has no proper nouns or unit abbreviations, and no duplicates', () => {
    for (const w of ['abraham', 'aaronson', 'cm', 'km', 'mg', 'ml']) {
      expect(wordSet.has(w), w).toBe(false);
    }
    expect(wordSet.size).toBe(words.length);
  });

  it('keeps a sane size', () => {
    expect(words.length).toBeGreaterThan(150000);
  });
});
