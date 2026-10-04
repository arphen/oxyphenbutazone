import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFlashcards } from './useFlashcards.js';

// A fake game backend: /api/words answers for the list in use, /api/action validate-word accepts only `known` words
function stubBackend({ listWords, known }) {
  const requests = [];
  vi.stubGlobal('fetch', async (url, init) => {
    requests.push(url);
    if (String(url).startsWith('/api/words')) return { ok: true, json: async () => ({ words: listWords, count: listWords.length }) };
    const { word } = JSON.parse(init.body);
    return { ok: true, json: async () => ({ valid: known.has(word.toLowerCase()) }) };
  });
  return requests;
}

beforeEach(() => {
  const storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('useFlashcards.initializeCategory', () => {
  it('builds the cards from the list in use, asking for no particular list', async () => {
    const requests = stubBackend({ listWords: ['vav', 'vex', 'vug'], known: new Set(['vav', 'vex', 'vug']) });
    const flashcards = useFlashcards();
    await flashcards.initializeCategory('three-letter-v');
    // the category's own filters (3 letters, contains V), and no `dictionary=` (that would pin csw21/nwl2023/...)
    expect(requests.find((url) => url.startsWith('/api/words'))).toBe('/api/words?length=3&contains=V');
    expect(flashcards.currentCategory.value).toBe('three-letter-v');
    expect(flashcards.getFlashcards.value.map((card) => card.word).sort()).toEqual(['VAV', 'VEX', 'VUG']);
    expect(flashcards.stats.value.total).toBe(3);
    expect(flashcards.stats.value.new).toBe(3);
  });

  it('keeps only the words the player\'s list accepts', async () => {
    stubBackend({ listWords: ['jab', 'jag', 'jaq'], known: new Set(['jab', 'jag']) });
    const flashcards = useFlashcards();
    await flashcards.initializeCategory('three-letter-j');
    expect(flashcards.getFlashcards.value.map((card) => card.word).sort()).toEqual(['JAB', 'JAG']);
  });

  it('gives an empty category (no cards, not an error) when the list has no such words', async () => {
    stubBackend({ listWords: [], known: new Set() });
    const flashcards = useFlashcards();
    await flashcards.initializeCategory('three-letter-z');
    expect(flashcards.currentCategory.value).toBe('three-letter-z');
    expect(flashcards.stats.value.total).toBe(0);
    expect(flashcards.isLoading.value).toBe(false);
  });
});
