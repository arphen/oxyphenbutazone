// Word lists and word queries. Pure: callers load list text (from fs, fetch or an imported file).

export const DICTIONARY_IDS = ['csw21', 'nwl2023', 'enable', 'slovenian'];
export const ENGLISH_IDS = ['csw21', 'nwl2023', 'enable'];
export const DICTIONARY_LABELS = { csw21: 'CSW21', nwl2023: 'NWL2023', enable: 'ENABLE', slovenian: 'Slovenian' };

const NONE = { csw21: false, nwl2023: false, enable: false, slovenian: false };
const only = (id) => ({ ...NONE, [id]: true });

// The English list to use when the player has not chosen one: CSW21, else NWL2023, else ENABLE (open list), from what
// this deployment actually has. With nothing known it is CSW21 (the laptop host's default).
const defaultEnglish = (available) => ENGLISH_IDS.find((id) => available.includes(id)) ?? 'csw21';

// Dictionaries for a game whose language was chosen explicitly: Slovenian has a single list; English keeps the
// player's English choices (dropping Slovenian), defaulting to the best available English list.
export function selectionForNewGame(language, current, available = DICTIONARY_IDS) {
  if (language === 'slovenian') return only('slovenian');
  const keep = ENGLISH_IDS.filter((id) => current[id]);
  if (keep.length) return { ...NONE, ...Object.fromEntries(keep.map((id) => [id, true])) };
  return only(defaultEnglish(available));
}

// Dictionaries for a plain restart: keep the selection unless it cannot suit the language.
export function defaultSelectionFor(language, current, available = DICTIONARY_IDS) {
  if (language === 'slovenian') return current.slovenian ? current : only('slovenian');
  return ENGLISH_IDS.some((id) => current[id]) ? current : only(defaultEnglish(available));
}

// Parse a list: one entry per line, either `WORD` or `WORD definition [metadata]`. Returns Map(word -> definition|null).
export function parseDictionaryFile(content) {
  const dictionary = new Map();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(\S+)\s+(.+)$/);
    if (match) dictionary.set(match[1].toLowerCase(), match[2]);
    else dictionary.set(trimmed.toLowerCase(), null);
  }
  return dictionary;
}

export function createDictionaryStore() {
  const lists = Object.fromEntries(DICTIONARY_IDS.map((id) => [id, new Map()]));
  const declared = new Set(); // lists this deployment can supply even if not loaded yet
  let active = new Set();
  let selection = { ...NONE, csw21: true };

  const rebuild = () => {
    active = new Set();
    for (const id of DICTIONARY_IDS) {
      if (selection[id]) for (const word of lists[id].keys()) active.add(word);
    }
  };

  return {
    /** Load (or replace) one list from its text. */
    load(id, content) {
      if (!DICTIONARY_IDS.includes(id)) throw new Error(`Unknown dictionary: ${id}`);
      lists[id] = parseDictionaryFile(content);
      if (selection[id]) rebuild();
      return lists[id].size;
    },
    isLoaded: (id) => lists[id]?.size > 0,
    /** Say which lists this deployment ships (they may not be loaded yet). */
    declare(ids) {
      ids.filter((id) => DICTIONARY_IDS.includes(id)).forEach((id) => declared.add(id));
    },
    /** The opposite of declare(): this deployment no longer supplies these (e.g. an imported list was removed). */
    undeclare(ids) {
      ids.forEach((id) => declared.delete(id));
    },
    /** Lists that are loaded or declared available, in DICTIONARY_IDS order. */
    available: () => DICTIONARY_IDS.filter((id) => declared.has(id) || lists[id].size > 0),
    /** The loaded lists that suit `language`, best first; used when a chosen list turns out to be unavailable. */
    loadedFor: (language) => (language === 'slovenian' ? ['slovenian'] : ENGLISH_IDS).filter((id) => lists[id].size > 0),
    size: (id) => lists[id]?.size ?? 0,
    getSelection: () => ({ ...selection }),
    setSelection(next) {
      selection = Object.fromEntries(DICTIONARY_IDS.map((id) => [id, Boolean(next[id])]));
      rebuild();
    },
    /** Is `word` valid in the currently selected dictionaries? */
    has: (word) => active.has(String(word).toLowerCase()),
    get activeSize() {
      return active.size;
    },
    /** Definition from the first list that knows the word (CSW21, then NWL2023, then Slovenian). */
    definition(word) {
      const lower = String(word).toLowerCase();
      for (const id of DICTIONARY_IDS) {
        if (lists[id].has(lower)) return lists[id].get(lower);
      }
      return null;
    },
    /** Word query used by the practice modes. All filters are optional and combine with AND. */
    words({ dictionary, length, contains, containsAny, startsWith, endsWith, excludes } = {}) {
      let words = DICTIONARY_IDS.includes(dictionary) ? Array.from(lists[dictionary].keys()) : Array.from(active);

      if (length) {
        const target = parseInt(length);
        words = words.filter((w) => w.length === target);
      }
      const letters = (s) => s.toUpperCase().split(',').map((l) => l.trim());
      if (contains) {
        const need = letters(contains);
        words = words.filter((w) => need.every((l) => w.toUpperCase().includes(l)));
      }
      if (containsAny) {
        const any = letters(containsAny);
        words = words.filter((w) => any.some((l) => w.toUpperCase().includes(l)));
      }
      if (startsWith) {
        const prefix = startsWith.toUpperCase();
        words = words.filter((w) => w.toUpperCase().startsWith(prefix));
      }
      if (endsWith) {
        const suffix = endsWith.toUpperCase();
        words = words.filter((w) => w.toUpperCase().endsWith(suffix));
      }
      if (excludes) {
        const banned = letters(excludes);
        words = words.filter((w) => !banned.some((l) => w.toUpperCase().includes(l)));
      }
      return { words, count: words.length };
    },
  };
}
