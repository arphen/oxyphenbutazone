import { describe, it, expect } from 'vitest';
import {
  DICTIONARY_IDS,
  DICTIONARY_LABELS,
  parseDictionaryFile,
  createDictionaryStore,
  selectionForNewGame,
  defaultSelectionFor,
} from './dictionary.js';

const sel = (csw21, nwl2023, slovenian, enable = false, friendly = false) => ({ csw21, nwl2023, enable, friendly, slovenian });

describe('constants', () => {
  it('lists the five dictionaries in lookup-priority order with labels', () => {
    expect(DICTIONARY_IDS).toEqual(['csw21', 'nwl2023', 'enable', 'friendly', 'slovenian']);
    expect(DICTIONARY_LABELS).toEqual({ csw21: 'CSW21', nwl2023: 'NWL2023', enable: 'ENABLE', friendly: 'Friendly', slovenian: 'Slovenian' });
  });
});

describe('parseDictionaryFile', () => {
  it('parses a bare word with a null definition', () => {
    const map = parseDictionaryFile('AA');
    expect([...map.entries()]).toEqual([['aa', null]]);
  });

  it('parses word + definition', () => {
    const map = parseDictionaryFile('AAH to exclaim in surprise');
    expect(map.get('aah')).toBe('to exclaim in surprise');
  });

  it('keeps everything after the first whitespace run as the definition (including brackets)', () => {
    const map = parseDictionaryFile('ABA a fabric [n -S]');
    expect(map.get('aba')).toBe('a fabric [n -S]');
  });

  it('splits on a tab too', () => {
    expect(parseDictionaryFile('cat\tfeline').get('cat')).toBe('feline');
  });

  it('lowercases words but not definitions', () => {
    const map = parseDictionaryFile('CaT A Small Animal');
    expect(map.has('CaT')).toBe(false);
    expect(map.get('cat')).toBe('A Small Animal');
  });

  it('handles mixed bare and defined lines', () => {
    const map = parseDictionaryFile('AA\nAAH exclaim\nAAL\n');
    expect(map.size).toBe(3);
    expect(map.get('aa')).toBeNull();
    expect(map.get('aah')).toBe('exclaim');
    expect(map.get('aal')).toBeNull();
  });

  it('skips blank and whitespace-only lines', () => {
    const map = parseDictionaryFile('\n\ncat\n   \n\t\ndog\n\n');
    expect([...map.keys()]).toEqual(['cat', 'dog']);
  });

  it('trims CRLF line endings so words and definitions carry no \\r', () => {
    const map = parseDictionaryFile('cat feline\r\ndog\r\nbird flyer\r\n');
    expect([...map.keys()]).toEqual(['cat', 'dog', 'bird']);
    expect(map.get('cat')).toBe('feline');
    expect(map.get('dog')).toBeNull();
    expect(map.get('bird')).toBe('flyer');
    expect(map.has('dog\r')).toBe(false);
  });

  it('trims surrounding whitespace on each line', () => {
    const map = parseDictionaryFile('   cat   feline  \n  dog  ');
    expect(map.get('cat')).toBe('feline');
    expect(map.get('dog')).toBeNull();
  });

  it('returns an empty map for empty input', () => {
    expect(parseDictionaryFile('').size).toBe(0);
    expect(parseDictionaryFile('\n\n').size).toBe(0);
  });

  it('lets a later duplicate overwrite an earlier one and counts it once', () => {
    const map = parseDictionaryFile('cat old\nCAT new');
    expect(map.size).toBe(1);
    expect(map.get('cat')).toBe('new');
  });

  it('lowercases non-ascii letters', () => {
    expect(parseDictionaryFile('ČŠŽ').has('čšž')).toBe(true);
  });
});

describe('createDictionaryStore: loading', () => {
  it('starts empty with the csw21 selection', () => {
    const store = createDictionaryStore();
    expect(store.isLoaded('csw21')).toBe(false);
    expect(store.size('csw21')).toBe(0);
    expect(store.activeSize).toBe(0);
    expect(store.getSelection()).toEqual(sel(true, false, false));
    expect(store.has('cat')).toBe(false);
  });

  it('load returns the number of words and updates isLoaded and size', () => {
    const store = createDictionaryStore();
    expect(store.load('nwl2023', 'cat\ndog\nbird')).toBe(3);
    expect(store.isLoaded('nwl2023')).toBe(true);
    expect(store.size('nwl2023')).toBe(3);
    expect(store.isLoaded('csw21')).toBe(false);
    expect(store.isLoaded('slovenian')).toBe(false);
  });

  it('load of an empty file leaves the list not loaded', () => {
    const store = createDictionaryStore();
    expect(store.load('csw21', '')).toBe(0);
    expect(store.isLoaded('csw21')).toBe(false);
  });

  it('size and isLoaded are safe for unknown ids', () => {
    const store = createDictionaryStore();
    expect(store.size('nope')).toBe(0);
    expect(store.isLoaded('nope')).toBe(false);
  });

  it('rejects unknown dictionary ids', () => {
    const store = createDictionaryStore();
    expect(() => store.load('collins', 'cat')).toThrow('Unknown dictionary: collins');
    expect(() => store.load('__proto__', 'cat')).toThrow('Unknown dictionary');
  });

  it('replaces a list on re-load', () => {
    const store = createDictionaryStore();
    store.load('csw21', 'cat\ndog');
    store.load('csw21', 'bird');
    expect(store.size('csw21')).toBe(1);
    expect(store.has('cat')).toBe(false);
    expect(store.has('bird')).toBe(true);
  });

  it('a list loaded while selected is immediately active', () => {
    const store = createDictionaryStore(); // csw21 selected by default
    store.load('csw21', 'cat\ndog');
    expect(store.activeSize).toBe(2);
    expect(store.has('cat')).toBe(true);
  });

  it('a list loaded while NOT selected is not active until selected', () => {
    const store = createDictionaryStore();
    store.load('nwl2023', 'cat');
    expect(store.has('cat')).toBe(false);
    expect(store.activeSize).toBe(0);
    store.setSelection(sel(false, true, false));
    expect(store.has('cat')).toBe(true);
    expect(store.activeSize).toBe(1);
  });
});

describe('createDictionaryStore: selection and has', () => {
  const build = () => {
    const store = createDictionaryStore();
    store.load('csw21', 'cat\ndog\nzzz');
    store.load('nwl2023', 'cat\nbird');
    store.load('slovenian', 'miza\nstol');
    return store;
  };

  it('has is case-insensitive', () => {
    const store = build();
    expect(store.has('cat')).toBe(true);
    expect(store.has('CAT')).toBe(true);
    expect(store.has('CaT')).toBe(true);
    expect(store.has('cow')).toBe(false);
  });

  it('has stringifies its argument', () => {
    const store = createDictionaryStore();
    store.load('csw21', '123\nnull');
    expect(store.has(123)).toBe(true);
    expect(store.has(null)).toBe(true);
    expect(store.has(undefined)).toBe(false);
  });

  it('only csw21 selected: only csw21 words', () => {
    const store = build();
    expect(store.has('dog')).toBe(true);
    expect(store.has('bird')).toBe(false);
    expect(store.has('miza')).toBe(false);
    expect(store.activeSize).toBe(3);
  });

  it('union of csw21 + nwl2023, with the shared word counted once', () => {
    const store = build();
    store.setSelection(sel(true, true, false));
    expect(store.has('dog')).toBe(true);
    expect(store.has('bird')).toBe(true);
    expect(store.has('miza')).toBe(false);
    expect(store.activeSize).toBe(4); // cat, dog, zzz, bird
  });

  it('union of all three', () => {
    const store = build();
    store.setSelection(sel(true, true, true));
    expect(store.activeSize).toBe(6); // cat, dog, zzz, bird, miza, stol
    expect(store.has('stol')).toBe(true);
  });

  it('only slovenian', () => {
    const store = build();
    store.setSelection(sel(false, false, true));
    expect(store.has('miza')).toBe(true);
    expect(store.has('cat')).toBe(false);
    expect(store.activeSize).toBe(2);
  });

  it('nothing selected: nothing is valid', () => {
    const store = build();
    store.setSelection(sel(false, false, false));
    expect(store.has('cat')).toBe(false);
    expect(store.activeSize).toBe(0);
  });

  it('setSelection coerces to booleans and ignores unknown keys', () => {
    const store = build();
    store.setSelection({ csw21: 0, nwl2023: 'yes', slovenian: undefined, extra: true });
    expect(store.getSelection()).toEqual(sel(false, true, false));
  });

  it('getSelection returns a copy that cannot change the store', () => {
    const store = build();
    const copy = store.getSelection();
    copy.slovenian = true;
    expect(store.getSelection().slovenian).toBe(false);
    expect(store.has('miza')).toBe(false);
  });

  it('re-loading a selected list refreshes the union', () => {
    const store = build();
    store.setSelection(sel(true, true, false));
    store.load('nwl2023', 'newword');
    expect(store.has('bird')).toBe(false);
    expect(store.has('newword')).toBe(true);
    expect(store.has('cat')).toBe(true); // still in csw21
  });
});

describe('createDictionaryStore: definition', () => {
  it('prefers csw21, then nwl2023, then slovenian', () => {
    const store = createDictionaryStore();
    store.load('slovenian', 'both slo-def\nonlyslo slo-only');
    store.load('nwl2023', 'both nwl-def\nnwlonly nwl-only\nshared2 nwl-shared2');
    store.load('csw21', 'both csw-def\nshared2 csw-shared2');
    expect(store.definition('both')).toBe('csw-def');
    expect(store.definition('shared2')).toBe('csw-shared2');
    expect(store.definition('nwlonly')).toBe('nwl-only');
    expect(store.definition('onlyslo')).toBe('slo-only');
  });

  it('is case-insensitive', () => {
    const store = createDictionaryStore();
    store.load('csw21', 'cat feline');
    expect(store.definition('CAT')).toBe('feline');
    expect(store.definition('Cat')).toBe('feline');
  });

  it('returns null for unknown words', () => {
    const store = createDictionaryStore();
    store.load('csw21', 'cat feline');
    expect(store.definition('dog')).toBeNull();
  });

  it('returns null for a known word with no definition', () => {
    const store = createDictionaryStore();
    store.load('csw21', 'cat');
    expect(store.definition('cat')).toBeNull();
  });

  it('a null definition in csw21 stops the lookup (first list that knows the word wins)', () => {
    const store = createDictionaryStore();
    store.load('csw21', 'cat');
    store.load('nwl2023', 'cat feline');
    expect(store.definition('cat')).toBeNull();
  });

  it('works regardless of which dictionaries are selected', () => {
    const store = createDictionaryStore();
    store.load('slovenian', 'miza table');
    store.setSelection(sel(true, false, false));
    expect(store.has('miza')).toBe(false);
    expect(store.definition('miza')).toBe('table');
  });
});

describe('createDictionaryStore: words()', () => {
  const build = () => {
    const store = createDictionaryStore();
    store.load('csw21', ['cat', 'cart', 'care', 'dog', 'dot', 'tacos', 'zax', 'aa'].join('\n'));
    store.load('nwl2023', ['cat', 'bird', 'quiz'].join('\n'));
    store.load('slovenian', ['miza', 'stol'].join('\n'));
    return store;
  };
  const sorted = (r) => [...r.words].sort();

  it('defaults to the active union and returns count', () => {
    const store = build();
    const r = store.words();
    expect(r.count).toBe(8);
    expect(sorted(r)).toEqual(['aa', 'care', 'cart', 'cat', 'dog', 'dot', 'tacos', 'zax']);
  });

  it('words() with a specific dictionary ignores the selection', () => {
    const store = build();
    expect(sorted(store.words({ dictionary: 'slovenian' }))).toEqual(['miza', 'stol']);
    expect(sorted(store.words({ dictionary: 'nwl2023' }))).toEqual(['bird', 'cat', 'quiz']);
    expect(store.words({ dictionary: 'csw21' }).count).toBe(8);
  });

  it('an unknown dictionary id falls back to the active selection', () => {
    const store = build();
    expect(store.words({ dictionary: 'nope' }).count).toBe(8);
  });

  it('reflects the selection union when no dictionary is given', () => {
    const store = build();
    store.setSelection(sel(true, true, true));
    expect(store.words().count).toBe(12); // 8 + bird, quiz, miza, stol
  });

  it('length filter (number and numeric string)', () => {
    const store = build();
    expect(sorted(store.words({ length: 3 }))).toEqual(['cat', 'dog', 'dot', 'zax']);
    expect(sorted(store.words({ length: '4' }))).toEqual(['care', 'cart']);
    expect(store.words({ length: 9 }).count).toBe(0);
  });

  it('startsWith (case-insensitive)', () => {
    const store = build();
    expect(sorted(store.words({ startsWith: 'ca' }))).toEqual(['care', 'cart', 'cat']);
    expect(sorted(store.words({ startsWith: 'CA' }))).toEqual(['care', 'cart', 'cat']);
    expect(store.words({ startsWith: 'x' }).count).toBe(0);
  });

  it('endsWith (case-insensitive)', () => {
    const store = build();
    expect(sorted(store.words({ endsWith: 't' }))).toEqual(['cart', 'cat', 'dot']);
    expect(sorted(store.words({ endsWith: 'OS' }))).toEqual(['tacos']);
  });

  it('contains requires ALL comma-separated letters', () => {
    const store = build();
    expect(sorted(store.words({ contains: 'c,r' }))).toEqual(['care', 'cart']);
    expect(sorted(store.words({ contains: 'c, t' }))).toEqual(['cart', 'cat', 'tacos']);
    expect(sorted(store.words({ contains: 'Z' }))).toEqual(['zax']);
  });

  it('containsAny requires at least ONE of the letters', () => {
    const store = build();
    expect(sorted(store.words({ containsAny: 'z,d' }))).toEqual(['dog', 'dot', 'zax']);
    expect(sorted(store.words({ containsAny: 'x' }))).toEqual(['zax']);
  });

  it('excludes removes words with any banned letter', () => {
    const store = build();
    expect(sorted(store.words({ excludes: 'a' }))).toEqual(['dog', 'dot']);
    expect(sorted(store.words({ excludes: 'a,o' }))).toEqual([]);
    expect(sorted(store.words({ excludes: 'c,d,z' }))).toEqual(['aa']);
  });

  it('combines filters with AND', () => {
    const store = build();
    expect(sorted(store.words({ length: 4, startsWith: 'ca', endsWith: 'e' }))).toEqual(['care']);
    expect(sorted(store.words({ length: 3, contains: 'a', excludes: 'z' }))).toEqual(['cat']);
    expect(sorted(store.words({ startsWith: 'c', containsAny: 'r,t', excludes: 'e' }))).toEqual(['cart', 'cat']);
    expect(store.words({ length: 3, startsWith: 'z', endsWith: 'x', contains: 'a' }).words).toEqual(['zax']);
  });

  it('a dictionary filter combines with other filters', () => {
    const store = build();
    expect(sorted(store.words({ dictionary: 'nwl2023', length: 4 }))).toEqual(['bird', 'quiz']);
    expect(store.words({ dictionary: 'slovenian', endsWith: 'a' }).words).toEqual(['miza']);
  });

  it('count always equals words.length', () => {
    const store = build();
    for (const q of [{}, { length: 3 }, { startsWith: 'q' }, { contains: 'a,c' }, { excludes: 'a' }]) {
      const r = store.words(q);
      expect(r.count).toBe(r.words.length);
    }
  });

  it('works on an empty store', () => {
    const store = createDictionaryStore();
    expect(store.words()).toEqual({ words: [], count: 0 });
    expect(store.words({ length: 3, startsWith: 'a' })).toEqual({ words: [], count: 0 });
  });
});

describe('selectionForNewGame', () => {
  it('slovenian => slovenian only, whatever was selected', () => {
    expect(selectionForNewGame('slovenian', sel(true, true, false))).toEqual(sel(false, false, true));
    expect(selectionForNewGame('slovenian', sel(false, false, true))).toEqual(sel(false, false, true));
    expect(selectionForNewGame('slovenian', sel(true, true, true))).toEqual(sel(false, false, true));
  });

  it('english keeps an existing csw21 preference', () => {
    expect(selectionForNewGame('english', sel(true, false, false))).toEqual(sel(true, false, false));
  });

  it('english keeps an existing nwl2023 preference', () => {
    expect(selectionForNewGame('english', sel(false, true, false))).toEqual(sel(false, true, false));
  });

  it('english keeps both when both selected', () => {
    expect(selectionForNewGame('english', sel(true, true, false))).toEqual(sel(true, true, false));
  });

  it('english drops slovenian from a mixed selection', () => {
    expect(selectionForNewGame('english', sel(true, false, true))).toEqual(sel(true, false, false));
    expect(selectionForNewGame('english', sel(false, true, true))).toEqual(sel(false, true, false));
    expect(selectionForNewGame('english', sel(true, true, true))).toEqual(sel(true, true, false));
  });

  it('english with no english selection (slovenian only or nothing) defaults to ENABLE + Friendly together', () => {
    expect(selectionForNewGame('english', sel(false, false, true))).toEqual(sel(false, false, false, true, true));
    expect(selectionForNewGame('english', sel(false, false, false))).toEqual(sel(false, false, false, true, true));
  });

  it('does not mutate the input', () => {
    const current = sel(true, false, true);
    selectionForNewGame('english', current);
    expect(current).toEqual(sel(true, false, true));
  });
});

describe('defaultSelectionFor (plain restart)', () => {
  it('slovenian keeps a selection that includes slovenian (same object, untouched)', () => {
    const current = sel(true, false, true);
    expect(defaultSelectionFor('slovenian', current)).toBe(current);
    expect(defaultSelectionFor('slovenian', sel(false, false, true))).toEqual(sel(false, false, true));
  });

  it('slovenian without slovenian selected is repaired to slovenian only', () => {
    expect(defaultSelectionFor('slovenian', sel(true, true, false))).toEqual(sel(false, false, true));
    expect(defaultSelectionFor('slovenian', sel(false, false, false))).toEqual(sel(false, false, true));
  });

  it('english keeps any selection containing csw21 or nwl2023 (including mixed with slovenian)', () => {
    const mixed = sel(true, false, true);
    expect(defaultSelectionFor('english', mixed)).toBe(mixed);
    expect(defaultSelectionFor('english', sel(false, true, false))).toEqual(sel(false, true, false));
    expect(defaultSelectionFor('english', sel(true, true, false))).toEqual(sel(true, true, false));
  });

  it('english with only slovenian or nothing is repaired to ENABLE + Friendly', () => {
    expect(defaultSelectionFor('english', sel(false, false, true))).toEqual(sel(false, false, false, true, true));
    expect(defaultSelectionFor('english', sel(false, false, false))).toEqual(sel(false, false, false, true, true));
  });

  it('an unknown language is treated like english', () => {
    expect(defaultSelectionFor('klingon', sel(false, false, true))).toEqual(sel(false, false, false, true, true));
    expect(defaultSelectionFor('klingon', sel(false, true, false))).toEqual(sel(false, true, false));
  });
});

describe('ENABLE (the open English list) and availability-aware defaults', () => {
  it('is its own selectable list, with no definitions, after the Collins/NASPA lists in lookup order', () => {
    const store = createDictionaryStore();
    store.load('enable', 'aa\nzzz\n');
    store.load('nwl2023', 'zzz a long definition\n');
    store.setSelection({ enable: true });
    expect(store.has('aa')).toBe(true);
    expect(store.activeSize).toBe(2);
    expect(store.definition('zzz')).toBe('a long definition'); // nwl2023 answers before enable
    expect(store.definition('aa')).toBeNull();
  });

  it('a selection naming only ENABLE keeps ENABLE when english is chosen, and drops slovenian', () => {
    expect(selectionForNewGame('english', sel(false, false, true, true))).toEqual(sel(false, false, false, true));
    expect(selectionForNewGame('english', sel(true, false, false, true))).toEqual(sel(true, false, false, true));
  });

  it('with no english choice the default is the best AVAILABLE english list', () => {
    const none = sel(false, false, true);
    expect(selectionForNewGame('english', none, ['csw21', 'enable', 'slovenian'])).toEqual(sel(true, false, false));
    expect(selectionForNewGame('english', none, ['nwl2023', 'enable'])).toEqual(sel(false, true, false));
    expect(selectionForNewGame('english', none, ['enable', 'slovenian'])).toEqual(sel(false, false, false, true));
    expect(selectionForNewGame('english', none, [])).toEqual(sel(true, false, false)); // nothing known: csw21
    expect(defaultSelectionFor('english', none, ['enable'])).toEqual(sel(false, false, false, true));
  });

  it('a plain restart keeps an ENABLE-only selection', () => {
    const current = sel(false, false, false, true);
    expect(defaultSelectionFor('english', current, ['csw21', 'enable'])).toBe(current);
  });

  it('declare() and available() track lists a deployment ships, plus anything loaded', () => {
    const store = createDictionaryStore();
    expect(store.available()).toEqual([]);
    store.declare(['slovenian', 'enable', 'bogus']);
    expect(store.available()).toEqual(['enable', 'slovenian']); // unknown ids ignored, canonical order
    store.load('csw21', 'cat\n');
    expect(store.available()).toEqual(['csw21', 'enable', 'slovenian']);
  });

  it('undeclare() removes a declared list from available() but not a loaded one', () => {
    const store = createDictionaryStore();
    store.declare(['csw21', 'enable', 'slovenian']);
    store.load('enable', 'aa\n');
    store.undeclare(['csw21', 'enable', 'bogus']);
    expect(store.available()).toEqual(['enable', 'slovenian']); // enable is still loaded
    store.load('enable', ''); // unloading it (what removing an imported list does)
    expect(store.available()).toEqual(['slovenian']);
    expect(store.isLoaded('enable')).toBe(false);
  });

  it('loadedFor() lists only loaded lists that suit the language, best first', () => {
    const store = createDictionaryStore();
    store.declare(['csw21']); // declared but not loaded does not count
    store.load('enable', 'aa\n');
    store.load('nwl2023', 'bb\n');
    store.load('slovenian', 'miza\n');
    expect(store.loadedFor('english')).toEqual(['nwl2023', 'enable']);
    expect(store.loadedFor('slovenian')).toEqual(['slovenian']);
  });
});

describe('Friendly (casual shorts) and union defaults', () => {
  it('skips # comment lines so shipped headers never become words', () => {
    const map = parseDictionaryFile('# Friendly header\nZA\n# comment\nZO\n');
    expect([...map.keys()]).toEqual(['za', 'zo']);
  });

  it('defaults a fresh English game to ENABLE + Friendly together when both ship', () => {
    const none = sel(false, false, false);
    expect(selectionForNewGame('english', none, ['enable', 'friendly', 'slovenian'])).toEqual(
      sel(false, false, false, true, true)
    );
    expect(defaultSelectionFor('english', none, ['enable', 'friendly'])).toEqual(sel(false, false, false, true, true));
  });

  it('falls back to a single list when only one of ENABLE/Friendly ships', () => {
    const none = sel(false, false, false);
    expect(selectionForNewGame('english', none, ['enable', 'slovenian'])).toEqual(sel(false, false, false, true));
    expect(selectionForNewGame('english', none, ['friendly', 'slovenian'])).toEqual(sel(false, false, false, false, true));
  });

  it('a word in ANY selected list is valid (union), e.g. Friendly-only ZA alongside ENABLE-only CAT', () => {
    const store = createDictionaryStore();
    store.load('enable', 'cat\ndog\n');
    store.load('friendly', 'za\nzo\nqi\n');
    store.setSelection(sel(false, false, false, true, true));
    expect(store.has('ZA')).toBe(true);
    expect(store.has('zo')).toBe(true);
    expect(store.has('qi')).toBe(true);
    expect(store.has('cat')).toBe(true);
    expect(store.has('zzz')).toBe(false);
  });

  it('strict single-list selections still exclude the other list', () => {
    const store = createDictionaryStore();
    store.load('enable', 'cat\n');
    store.load('friendly', 'za\n');
    store.setSelection(sel(false, false, false, true));
    expect(store.has('za')).toBe(false);
    expect(store.has('cat')).toBe(true);
    store.setSelection(sel(false, false, false, false, true));
    expect(store.has('za')).toBe(true);
    expect(store.has('cat')).toBe(false);
  });
});
