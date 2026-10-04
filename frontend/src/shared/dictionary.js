// Word lists and word queries. Pure: callers load list text (from fs, fetch or an imported file).

export const DICTIONARY_IDS = ['csw21', 'nwl2023', 'slovenian'];
export const DICTIONARY_LABELS = { csw21: 'CSW21', nwl2023: 'NWL2023', slovenian: 'Slovenian' };

// Dictionaries for a game whose language was chosen explicitly: Slovenian has a single list; English keeps the
// player's CSW21/NWL2023 preference (dropping Slovenian), defaulting to CSW21.
export function selectionForNewGame(language, current) {
  if (language === 'slovenian') return { csw21: false, nwl2023: false, slovenian: true };
  if (current.csw21 || current.nwl2023) return { csw21: current.csw21, nwl2023: current.nwl2023, slovenian: false };
  return { csw21: true, nwl2023: false, slovenian: false };
}

// Dictionaries for a plain restart: keep the selection unless it cannot suit the language.
export function defaultSelectionFor(language, current) {
  if (language === 'slovenian') {
    return current.slovenian ? current : { csw21: false, nwl2023: false, slovenian: true };
  }
  return current.csw21 || current.nwl2023 ? current : { csw21: true, nwl2023: false, slovenian: false };
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
  const lists = { csw21: new Map(), nwl2023: new Map(), slovenian: new Map() };
  let active = new Set();
  let selection = { csw21: true, nwl2023: false, slovenian: false };

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
    size: (id) => lists[id]?.size ?? 0,
    getSelection: () => ({ ...selection }),
    setSelection(next) {
      selection = {
        csw21: Boolean(next.csw21),
        nwl2023: Boolean(next.nwl2023),
        slovenian: Boolean(next.slovenian),
      };
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
