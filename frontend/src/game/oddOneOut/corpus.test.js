import { describe, it, expect } from 'vitest';
import { loadCorpus, tileScore, CATEGORY_IDS, MIN_CORPUS_WORDS } from './corpus.js';

// A hand-made stand-in for GET /api/words: `lists` maps a list id to its (lowercase) words. It understands the query
// parameters the corpus code uses: dictionary, length, contains (ALL letters), containsAny and excludes.
function fakeServer(lists) {
  const calls = [];
  const fetchJson = async (url) => {
    calls.push(url);
    const { pathname, searchParams } = new URL(url, 'http://localhost');
    expect(pathname).toBe('/api/words');
    let words = [...(lists[searchParams.get('dictionary')] ?? [])];
    const letters = (name) => (searchParams.get(name) ?? '').toLowerCase().split(',');
    if (searchParams.get('length')) words = words.filter((w) => w.length === Number(searchParams.get('length')));
    if (searchParams.get('contains')) words = words.filter((w) => letters('contains').every((l) => w.includes(l)));
    if (searchParams.get('containsAny')) words = words.filter((w) => letters('containsAny').some((l) => w.includes(l)));
    if (searchParams.get('excludes')) words = words.filter((w) => !letters('excludes').some((l) => w.includes(l)));
    return { words, count: words.length };
  };
  return { fetchJson, calls };
}

describe('tileScore', () => {
  it('adds the English tile values by hand: FOX = 4+1+8, QAT = 10+1+1, ARK = 1+1+5', () => {
    expect(tileScore('FOX')).toBe(13);
    expect(tileScore('qat')).toBe(12);
    expect(tileScore('ARK')).toBe(7);
    expect(tileScore('AWE')).toBe(6);
    expect(tileScore('')).toBe(0);
  });
});

describe('category definitions', () => {
  it('knows exactly the eight categories', () => {
    expect([...CATEGORY_IDS].sort()).toEqual(['extensions', 'five-letter', 'four-letter', 'j-x-z', 'q-no-u', 'three-letter', 'two-letter', 'v-words']);
    expect(MIN_CORPUS_WORDS).toBe(5);
  });
});

describe('loadCorpus categories', () => {
  it('two-letter: only 2-letter words, uppercase, sorted', async () => {
    const { fetchJson } = fakeServer({ enable: ['ab', 'aa', 'cat', 'quiz', 'ox'] });
    const corpus = await loadCorpus('two-letter', ['enable'], fetchJson);
    expect(corpus.words).toEqual(['AA', 'AB', 'OX']);
  });

  it('three-letter: keeps tile score >= 7 (ARK = 7 stays, AWE = 6 goes)', async () => {
    // ARK 7, AWE 6, CAT 5, FOX 13, ZIT 12, QAT 12, DOG 5, and a 4-letter word that must not appear
    const { fetchJson } = fakeServer({ enable: ['ark', 'awe', 'cat', 'fox', 'zit', 'qat', 'dog', 'foxy'] });
    const corpus = await loadCorpus('three-letter', ['enable'], fetchJson);
    expect(corpus.words).toEqual(['ARK', 'FOX', 'QAT', 'ZIT']);
  });

  it('three-letter on the Slovenian list uses the Slovenian tile values (CEK with a caron = 5+1+3, NOC = 1+1+5, URA = 3)', async () => {
    // With English values CEK would score 0+1+5 = 6 and be dropped
    const { fetchJson } = fakeServer({ slovenian: ['ček', 'noč', 'ura'] });
    const corpus = await loadCorpus('three-letter', ['slovenian'], fetchJson);
    expect(corpus.words).toEqual(['NOČ', 'ČEK']);
  });

  it('four-letter and five-letter: exactly that length', async () => {
    const lists = { enable: ['at', 'cat', 'cave', 'dove', 'house', 'apple', 'planet'] };
    expect((await loadCorpus('four-letter', ['enable'], fakeServer(lists).fetchJson)).words).toEqual(['CAVE', 'DOVE']);
    expect((await loadCorpus('five-letter', ['enable'], fakeServer(lists).fetchJson)).words).toEqual(['APPLE', 'HOUSE']);
  });

  it('q-no-u: contains Q, has no U', async () => {
    const { fetchJson } = fakeServer({ enable: ['qi', 'qat', 'quit', 'qoph', 'suq', 'faqir', 'quack', 'cat'] });
    const corpus = await loadCorpus('q-no-u', ['enable'], fetchJson);
    expect(corpus.words).toEqual(['FAQIR', 'QAT', 'QI', 'QOPH']);
  });

  it('j-x-z: any of J, X, Z', async () => {
    const { fetchJson } = fakeServer({ enable: ['jab', 'fox', 'zit', 'cat', 'quiz', 'jinx', 'dog'] });
    const corpus = await loadCorpus('j-x-z', ['enable'], fetchJson);
    expect(corpus.words).toEqual(['FOX', 'JAB', 'JINX', 'QUIZ', 'ZIT']);
  });

  it('v-words: contains V', async () => {
    const { fetchJson } = fakeServer({ enable: ['vet', 'cave', 'cat', 'oven', 'dove', 'dog'] });
    const corpus = await loadCorpus('v-words', ['enable'], fetchJson);
    expect(corpus.words).toEqual(['CAVE', 'DOVE', 'OVEN', 'VET']);
  });

  it('extensions: 3-letter words whose last two or first two letters are a two-letter word', async () => {
    // two-letter words: AB, OX.  CAB, TAB end in AB; ABS starts with AB; FOX, BOX end in OX; OXO starts with OX.
    // CAT, BAT: neither AT nor BA is a two-letter word here.
    const lists = { enable: ['ab', 'ox', 'cab', 'tab', 'abs', 'fox', 'box', 'oxo', 'cat', 'bat'] };
    const corpus = await loadCorpus('extensions', ['enable'], fakeServer(lists).fetchJson);
    expect(corpus.words).toEqual(['ABS', 'BOX', 'CAB', 'FOX', 'OXO', 'TAB']);
  });

  it('applies the category definition itself even if the server ignores the filters', async () => {
    const lists = { enable: ['qi', 'qat', 'quit', 'jab', 'cat', 'vet', 'ark', 'awe', 'ox', 'cave', 'house'] };
    const sloppy = async () => ({ words: lists.enable });
    expect((await loadCorpus('q-no-u', ['enable'], sloppy)).words).toEqual(['QAT', 'QI']);
    expect((await loadCorpus('two-letter', ['enable'], sloppy)).words).toEqual(['OX', 'QI']);
    expect((await loadCorpus('three-letter', ['enable'], sloppy)).words).toEqual(['ARK', 'JAB', 'QAT']);
    expect((await loadCorpus('five-letter', ['enable'], sloppy)).words).toEqual(['HOUSE']);
  });
});

describe('loadCorpus with several lists', () => {
  it('unions the words of the selected lists without duplicates', async () => {
    const { fetchJson } = fakeServer({ enable: ['aa', 'ab'], nwl2023: ['ab', 'ba'], slovenian: ['ja'] });
    const corpus = await loadCorpus('two-letter', ['enable', 'nwl2023'], fetchJson);
    expect(corpus.words).toEqual(['AA', 'AB', 'BA']);
    // and a list that is not selected does not leak in
    expect(corpus.isValid('JA')).toBe(false);
  });

  it('extensions use the two-letter words of ALL selected lists', async () => {
    // FOX is in ENABLE only, OX is in NWL2023 only
    const { fetchJson } = fakeServer({ enable: ['fox', 'ab', 'cab'], nwl2023: ['ox', 'tab'] });
    const both = await loadCorpus('extensions', ['enable', 'nwl2023'], fetchJson);
    expect(both.words).toEqual(['CAB', 'FOX', 'TAB']);
    const onlyEnable = await loadCorpus('extensions', ['enable'], fetchJson);
    expect(onlyEnable.words).toEqual(['CAB']);
  });

  it('a word valid in one list but not in the other is valid for the combination', async () => {
    const { fetchJson } = fakeServer({ enable: ['aa', 'ab'], nwl2023: ['ab', 'zz'] });
    const corpus = await loadCorpus('two-letter', ['enable', 'nwl2023'], fetchJson);
    expect(corpus.isValid('ZZ')).toBe(true);
    expect(corpus.isValid('AA')).toBe(true);
    expect(corpus.isValid('AZ')).toBe(false);
  });
});

describe('loadCorpus validity set', () => {
  it('covers every real word of the lengths involved, not only the category', async () => {
    // Category: 3-letter words scoring >= 7. CAT (5) and DOG (5) are not in it but are real words, so altering
    // FOX into CAT-like words must not call them invalid. DAG comes from the other list.
    const { fetchJson } = fakeServer({ enable: ['fox', 'zit', 'cat', 'dog', 'ab', 'cave'], nwl2023: ['dag', 'ark'] });
    const corpus = await loadCorpus('three-letter', ['enable', 'nwl2023'], fetchJson);
    expect(corpus.words).toEqual(['ARK', 'FOX', 'ZIT']);
    expect(corpus.isValid('CAT')).toBe(true);
    expect(corpus.isValid('DOG')).toBe(true);
    expect(corpus.isValid('DAG')).toBe(true);
    expect(corpus.isValid('FOX')).toBe(true);
    expect(corpus.isValid('FIX')).toBe(false);
    // words of other lengths are not needed: a puzzle only ever swaps one letter
    expect(corpus.isValid('CAVE')).toBe(false);
    expect(corpus.validWords.size).toBe(6); // FOX ZIT CAT DOG DAG ARK
  });

  it('for letter-based categories it covers the lengths of the category words', async () => {
    // Q-no-U words have lengths 2 (QI), 3 (QAT), 4 (QOPH). QUIT (4) and SUQ (3) are real words outside the category.
    const { fetchJson } = fakeServer({ enable: ['qi', 'qat', 'qoph', 'quit', 'suq', 'quartz', 'cat'] });
    const corpus = await loadCorpus('q-no-u', ['enable'], fetchJson);
    expect(corpus.words).toEqual(['QAT', 'QI', 'QOPH']);
    expect(corpus.isValid('QUIT')).toBe(true);
    expect(corpus.isValid('SUQ')).toBe(true);
    expect(corpus.isValid('CAT')).toBe(true);
    expect(corpus.isValid('QUARTZ')).toBe(false); // length 6 is not involved
    expect(corpus.isValid('QO')).toBe(false);
  });

  it('asks the server for each query once', async () => {
    const { fetchJson, calls } = fakeServer({ enable: ['aa', 'ab'] });
    await loadCorpus('two-letter', ['enable'], fetchJson);
    expect(calls).toEqual(['/api/words?dictionary=enable&length=2']);
  });

  it('builds the request URLs from the category definition', async () => {
    const { fetchJson, calls } = fakeServer({ enable: ['qat'] });
    await loadCorpus('q-no-u', ['enable'], fetchJson);
    expect(calls[0]).toBe('/api/words?dictionary=enable&contains=Q&excludes=U');
    expect(calls).toContain('/api/words?dictionary=enable&length=3');
    const second = fakeServer({ enable: ['jab'] });
    await loadCorpus('j-x-z', ['enable'], second.fetchJson);
    expect(new URL(second.calls[0], 'http://x').searchParams.get('containsAny')).toBe('J,X,Z');
  });
});

describe('loadCorpus errors', () => {
  it('rejects an unknown category, no lists and an unreadable answer', async () => {
    const { fetchJson } = fakeServer({ enable: ['aa'] });
    await expect(loadCorpus('nope', ['enable'], fetchJson)).rejects.toThrow(/Unknown category/);
    await expect(loadCorpus('two-letter', [], fetchJson)).rejects.toThrow(/at least one word list/);
    await expect(loadCorpus('two-letter', ['enable'], async () => ({ success: false }))).rejects.toThrow(/Could not read the enable word list/);
  });

  it('reports a category with too few words as a short word list, not an error', async () => {
    const { fetchJson } = fakeServer({ enable: ['aa', 'ab', 'cat'] });
    const corpus = await loadCorpus('two-letter', ['enable'], fetchJson);
    expect(corpus.words).toHaveLength(2);
    expect(corpus.words.length < MIN_CORPUS_WORDS).toBe(true);
  });
});
