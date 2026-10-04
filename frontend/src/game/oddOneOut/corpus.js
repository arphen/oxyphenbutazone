// Odd One Out word sets, built at run time from the word lists the player actually has (GET /api/words), so the app
// never needs a pre-built corpus. Words are UPPERCASE here; the /api/words endpoint returns lowercase.
//
// loadCorpus() returns the words of one category plus the set of ALL valid words (of the selected lists) of the lengths
// involved: an altered word must only be called invalid when it is a real word in none of the selected lists, even
// if it does not belong to the category.

import { TILE_DISTRIBUTIONS } from '../../shared/rules.js';

export const MIN_CORPUS_WORDS = 5; // one puzzle shows five words

/** Tile values of a list: the Slovenian list uses the Slovenian tile set, every other list the English one. */
const valuesFor = (listId) => TILE_DISTRIBUTIONS[listId === 'slovenian' ? 'slovenian' : 'english'].values;

/** Tile score of a word (any case); letters without a value count 0. */
export function tileScore(word, values = TILE_DISTRIBUTIONS.english.values) {
  let total = 0;
  for (const letter of word.toLowerCase()) total += values[letter] ?? 0;
  return total;
}

/**
 * Category definitions. `query` narrows the /api/words request; `accepts(word, ctx)` is the definition of the category,
 * applied to every word the server returns (so a category never depends on how well the server filtered).
 * ctx = { values: tile values of the list, twoLetter: Set of the two-letter words of all selected lists }.
 * `lengths` are the word lengths the category is made of; when absent they follow from the words found.
 */
export const CATEGORY_DEFS = {
  'two-letter': { query: { length: '2' }, accepts: (w) => w.length === 2, lengths: [2] },
  'three-letter': { query: { length: '3' }, accepts: (w, ctx) => w.length === 3 && tileScore(w, ctx.values) >= 7, lengths: [3] },
  'four-letter': { query: { length: '4' }, accepts: (w) => w.length === 4, lengths: [4] },
  'five-letter': { query: { length: '5' }, accepts: (w) => w.length === 5, lengths: [5] },
  'q-no-u': { query: { contains: 'Q', excludes: 'U' }, accepts: (w) => w.includes('Q') && !w.includes('U') },
  'j-x-z': { query: { containsAny: 'J,X,Z' }, accepts: (w) => /[JXZ]/.test(w) },
  'v-words': { query: { contains: 'V' }, accepts: (w) => w.includes('V') },
  extensions: {
    query: { length: '3' },
    needsTwoLetter: true,
    accepts: (w, ctx) => w.length === 3 && (ctx.twoLetter.has(w.slice(1)) || ctx.twoLetter.has(w.slice(0, -1))),
    lengths: [3],
  },
};

export const CATEGORY_IDS = Object.keys(CATEGORY_DEFS);

const wordsUrl = (listId, query) => `/api/words?${new URLSearchParams({ dictionary: listId, ...query })}`;

/**
 * @param categoryId one of CATEGORY_IDS
 * @param listIds    the selected word lists, e.g. ['enable', 'slovenian'] (their words are unioned)
 * @param fetchJson  async (url) => parsed JSON `{ words: string[] }`; injected so this stays testable
 * @returns {Promise<{ words: string[], validWords: Set<string>, isValid: (word: string) => boolean }>}
 */
export async function loadCorpus(categoryId, listIds, fetchJson) {
  const def = CATEGORY_DEFS[categoryId];
  if (!def) throw new Error(`Unknown category: ${categoryId}`);
  if (!Array.isArray(listIds) || listIds.length === 0) throw new Error('Select at least one word list.');

  // Identical requests (e.g. the 3-letter words for both the category and the validity set) are made once
  const cache = new Map();
  const fetchWords = (listId, query) => {
    const url = wordsUrl(listId, query);
    if (!cache.has(url)) {
      cache.set(
        url,
        Promise.resolve(fetchJson(url)).then((body) => {
          if (!body || !Array.isArray(body.words)) throw new Error(`Could not read the ${listId} word list.`);
          return body.words.map((w) => String(w).toUpperCase());
        })
      );
    }
    return cache.get(url);
  };

  // Extensions need the two-letter words of all selected lists
  let twoLetter = new Set();
  if (def.needsTwoLetter) {
    const twos = await Promise.all(listIds.map((id) => fetchWords(id, { length: '2' })));
    twoLetter = new Set(twos.flat().filter((w) => w.length === 2));
  }

  const found = await Promise.all(
    listIds.map(async (id) => {
      const ctx = { values: valuesFor(id), twoLetter };
      return (await fetchWords(id, def.query)).filter((w) => def.accepts(w, ctx));
    })
  );
  const words = [...new Set(found.flat())].sort();

  // Every real word of the lengths involved, from every selected list
  const lengths = def.lengths ?? [...new Set(words.map((w) => w.length))].sort((a, b) => a - b);
  const whole = await Promise.all(listIds.flatMap((id) => lengths.map((length) => fetchWords(id, { length: String(length) }))));
  const validWords = new Set(whole.flat());
  for (const w of words) validWords.add(w);

  return { words, validWords, isValid: (word) => validWords.has(word) };
}
