import { describe, it, expect } from 'vitest';
import { buildWordSet, fetchListWords, initialSelection, selectedIds } from './freePlayWords.js';

const NONE = { csw21: false, nwl2023: false, enable: false, slovenian: false };

// A fake /api/words: `lists` maps id -> words (lowercase, as the real endpoint returns them); an id that is not
// there answers like the real backend for a list it does not have (an empty result). `calls` records every URL.
function fakeFetch(lists, calls = []) {
  return async (url) => {
    calls.push(url);
    const id = new URL(url, 'http://app.test').searchParams.get('dictionary');
    const words = lists[id] ?? [];
    return { ok: true, json: async () => ({ words, count: words.length }) };
  };
}

describe('initialSelection', () => {
  it('starts with the lists the running game uses', () => {
    const game = { csw21: false, nwl2023: true, enable: true, slovenian: false };
    expect(initialSelection(game, ['nwl2023', 'enable', 'slovenian'])).toEqual({ ...NONE, nwl2023: true, enable: true });
  });

  it('drops game lists that are not installed, keeping the installed ones', () => {
    const game = { csw21: true, nwl2023: false, enable: true, slovenian: false };
    expect(initialSelection(game, ['enable', 'slovenian'])).toEqual({ ...NONE, enable: true });
  });

  it('falls back to the best installed list when the game uses none of them', () => {
    const game = { csw21: true, nwl2023: false, enable: false, slovenian: false };
    expect(initialSelection(game, ['enable', 'slovenian'])).toEqual({ ...NONE, enable: true }); // ENABLE beats Slovenian
    expect(initialSelection(null, ['nwl2023', 'enable'])).toEqual({ ...NONE, nwl2023: true }); // NWL2023 beats ENABLE
    expect(initialSelection(undefined, ['slovenian'])).toEqual({ ...NONE, slovenian: true });
  });

  it('with no restriction (laptop host) follows the game, else starts on CSW21', () => {
    expect(initialSelection({ ...NONE, slovenian: true }, null)).toEqual({ ...NONE, slovenian: true });
    expect(initialSelection(null, null)).toEqual({ ...NONE, csw21: true });
  });

  it('selects nothing when no list is installed', () => {
    expect(initialSelection({ ...NONE, csw21: true }, [])).toEqual(NONE);
    expect(initialSelection(null, [])).toEqual(NONE);
  });
});

describe('selectedIds', () => {
  it('lists the ticked ids in list order', () => {
    expect(selectedIds({ slovenian: true, csw21: true, enable: false })).toEqual(['csw21', 'slovenian']);
    expect(selectedIds(NONE)).toEqual([]);
    expect(selectedIds(null)).toEqual([]);
  });
});

describe('fetchListWords', () => {
  it('asks for one list by id and upper-cases the words', async () => {
    const calls = [];
    const words = await fetchListWords('enable', fakeFetch({ enable: ['cat', 'Dog'] }, calls));
    expect(calls).toEqual(['/api/words?dictionary=enable']);
    expect([...words].sort()).toEqual(['CAT', 'DOG']);
  });

  it('returns null for an empty list (not installed), a failed request and a thrown error', async () => {
    expect(await fetchListWords('csw21', fakeFetch({}))).toBeNull();
    expect(await fetchListWords('csw21', async () => ({ ok: false, json: async () => ({ words: ['x'] }) }))).toBeNull();
    expect(await fetchListWords('csw21', async () => { throw new Error('offline'); })).toBeNull();
    expect(await fetchListWords('csw21', async () => ({ ok: true, json: async () => ({ error: 'bad' }) }))).toBeNull();
  });
});

describe('buildWordSet', () => {
  it('is the union of the selected lists, upper case', async () => {
    const fetchFn = fakeFetch({ csw21: ['qi', 'cat'], enable: ['cat', 'dog'] });
    const { words, loaded, failed } = await buildWordSet(['csw21', 'enable'], new Map(), fetchFn);
    expect([...words].sort()).toEqual(['CAT', 'DOG', 'QI']);
    expect(loaded).toEqual(['csw21', 'enable']);
    expect(failed).toEqual([]);
  });

  it('only fetches the lists it has not seen, so ticking a list again is free', async () => {
    const calls = [];
    const fetchFn = fakeFetch({ csw21: ['qi'], enable: ['dog'] }, calls);
    const cache = new Map();
    await buildWordSet(['enable'], cache, fetchFn);
    const second = await buildWordSet(['enable', 'csw21'], cache, fetchFn);
    expect(calls).toEqual(['/api/words?dictionary=enable', '/api/words?dictionary=csw21']);
    expect([...second.words].sort()).toEqual(['DOG', 'QI']);
    await buildWordSet(['csw21'], cache, fetchFn);
    expect(calls).toHaveLength(2);
  });

  it('reports a list that is not installed and still accepts the words of the others', async () => {
    const { words, loaded, failed } = await buildWordSet(['csw21', 'enable'], new Map(), fakeFetch({ enable: ['dog'] }));
    expect([...words]).toEqual(['DOG']);
    expect(loaded).toEqual(['enable']);
    expect(failed).toEqual(['csw21']);
  });

  it('is empty, with nothing loaded, when no list is selected or none can be loaded', async () => {
    const none = await buildWordSet([], new Map(), fakeFetch({ enable: ['dog'] }));
    expect(none).toEqual({ words: new Set(), loaded: [], failed: [] });
    const missing = await buildWordSet(['csw21'], new Map(), fakeFetch({}));
    expect(missing.words.size).toBe(0);
    expect(missing.loaded).toEqual([]);
    expect(missing.failed).toEqual(['csw21']);
  });

  it('does not remember a failed list, so it can load once the player imports it', async () => {
    const cache = new Map();
    await buildWordSet(['csw21'], cache, fakeFetch({}));
    const after = await buildWordSet(['csw21'], cache, fakeFetch({ csw21: ['zzyzx'] }));
    expect([...after.words]).toEqual(['ZZYZX']);
  });
});
