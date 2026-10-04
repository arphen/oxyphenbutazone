// Which words Free Play accepts: the union of the word lists the player picked, fetched from the game's own
// /api/words endpoint (the in-browser backend in the static build, the dev server in laptop mode). Nothing here
// names a file, so it works with whatever lists the player has (only ENABLE in the public build).

import { DICTIONARY_IDS } from '../shared/dictionary.js';

const NONE = Object.fromEntries(DICTIONARY_IDS.map((id) => [id, false]));

/**
 * The lists to start with: the ones the running game uses, else the best list available.
 * @param gameDictionaries  `dictionaries` from /api/game-state ({ csw21, nwl2023, enable, friendly, slovenian } booleans), or null
 * @param installed         ids of the lists this device has, or null when every list may be asked for (laptop host)
 * @returns {{csw21: boolean, nwl2023: boolean, enable: boolean, friendly: boolean, slovenian: boolean}} all false when nothing is installed
 */
export function initialSelection(gameDictionaries, installed = null) {
  const usable = (id) => !installed || installed.includes(id);
  const fromGame = Object.fromEntries(DICTIONARY_IDS.map((id) => [id, Boolean(gameDictionaries?.[id]) && usable(id)]));
  if (DICTIONARY_IDS.some((id) => fromGame[id])) return fromGame;

  const available = installed ? DICTIONARY_IDS.filter((id) => installed.includes(id)) : DICTIONARY_IDS;
  if (available.length === 0) return { ...NONE };
  return { ...NONE, [available[0]]: true }; // DICTIONARY_IDS is ordered best first: CSW21, NWL2023, ENABLE, Friendly, Slovenian
}

/** The ids ticked in `selection`, in list order. */
export function selectedIds(selection) {
  return DICTIONARY_IDS.filter((id) => selection?.[id]);
}

/** One list's words, upper case, or null when it could not be loaded (not installed, request failed, empty). */
export async function fetchListWords(id, fetchFn = fetch) {
  try {
    const response = await fetchFn(`/api/words?dictionary=${encodeURIComponent(id)}`);
    if (!response.ok) return null;
    const { words } = await response.json();
    if (!Array.isArray(words) || words.length === 0) return null;
    return new Set(words.map((word) => String(word).toUpperCase()));
  } catch {
    return null;
  }
}

/**
 * The words to accept for the selected lists. `cache` (a Map id -> Set, kept by the caller) makes ticking a list
 * a second time free. Lists that could not be loaded are reported in `failed` and contribute nothing.
 * @returns {Promise<{words: Set<string>, loaded: string[], failed: string[]}>}
 */
export async function buildWordSet(ids, cache = new Map(), fetchFn = fetch) {
  await Promise.all(
    ids
      .filter((id) => !cache.has(id))
      .map(async (id) => {
        const words = await fetchListWords(id, fetchFn);
        if (words) cache.set(id, words);
      })
  );
  const loaded = ids.filter((id) => cache.has(id));
  const failed = ids.filter((id) => !cache.has(id));
  const words = new Set();
  for (const id of loaded) for (const word of cache.get(id)) words.add(word);
  return { words, loaded, failed };
}
