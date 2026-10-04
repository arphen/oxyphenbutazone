import { describe, it, expect } from 'vitest';
import {
  safeJsonParse,
  cleanString,
  sanitizeAction,
  sanitizeGameState,
  trySanitizeGameState,
  ProtocolError,
  ACTION_TYPES,
  MAX_ACTION_BYTES,
  MAX_STATE_BYTES,
  MAX_PLAYERS,
} from './protocol.js';
import { createEngine } from './engine.js';
import { createDictionaryStore } from './dictionary.js';

// Simple LCG RNG for deterministic tests
const createSeededRng = (seed) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
};

const makeEngine = (seed = 7) => {
  const store = createDictionaryStore();
  store.load('csw21', 'cat\ndog\n');
  return createEngine(store, { random: createSeededRng(seed) });
};

const clone = (value) => JSON.parse(JSON.stringify(value));

// A real state as a guest would receive it over the wire (JSON round-tripped).
const realState = (playerCount = 4) => {
  const engine = makeEngine();
  engine.dispatch({ type: 'restart', playerCount });
  return clone(engine.getState());
};

describe('constants', () => {
  it('exposes 11 action types and the player cap', () => {
    expect(ACTION_TYPES).toHaveLength(11);
    expect(new Set(ACTION_TYPES).size).toBe(11);
    expect(MAX_PLAYERS).toBe(4);
    expect(MAX_ACTION_BYTES).toBe(4096);
    expect(MAX_STATE_BYTES).toBe(1024 * 1024);
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"a":1,"b":[true,null,"x"]}')).toEqual({ a: 1, b: [true, null, 'x'] });
  });

  it.each([[undefined], [null], [42], [{}], [['{}']], [true]])('rejects non-string input %j', (input) => {
    expect(() => safeJsonParse(input)).toThrow(ProtocolError);
    expect(() => safeJsonParse(input)).toThrow('Message is not text');
  });

  it('rejects over-size input using the default cap', () => {
    const big = '"' + 'a'.repeat(MAX_STATE_BYTES) + '"';
    expect(() => safeJsonParse(big)).toThrow('Message too large');
  });

  it('rejects over-size input using a custom cap, accepts exactly at the cap', () => {
    expect(() => safeJsonParse('[1,2,3,4]', 8)).toThrow('Message too large'); // 9 chars > 8
    expect(safeJsonParse('[1,2,3]', 7)).toEqual([1, 2, 3]); // exactly 7 chars
  });

  it.each([['{'], ['not json'], [''], ["{'a':1}"], ['{"a":1,}'], ['undefined']])('rejects invalid JSON %j', (text) => {
    expect(() => safeJsonParse(text)).toThrow(ProtocolError);
    expect(() => safeJsonParse(text)).toThrow('Message is not valid JSON');
  });

  it('drops __proto__, constructor and prototype keys', () => {
    const parsed = safeJsonParse('{"a":1,"__proto__":{"polluted":true},"constructor":{"x":1},"prototype":{"y":2}}');
    expect(parsed).toEqual({ a: 1 });
    expect(Object.keys(parsed)).toEqual(['a']);
    expect(Object.hasOwn(parsed, '__proto__')).toBe(false);
    expect(Object.hasOwn(parsed, 'constructor')).toBe(false);
    expect(Object.hasOwn(parsed, 'prototype')).toBe(false);
    expect({}.polluted).toBeUndefined();
  });

  it('drops forbidden keys when nested in objects and arrays', () => {
    const parsed = safeJsonParse('{"a":{"b":{"__proto__":{"polluted":1},"keep":2}},"list":[{"constructor":{"prototype":{"polluted":3}},"ok":true}]}');
    expect(parsed).toEqual({ a: { b: { keep: 2 } }, list: [{ ok: true }] });
    expect({}.polluted).toBeUndefined();
    expect(Object.prototype.polluted).toBeUndefined();
  });

  it('does not alter the prototype of the parsed object', () => {
    const parsed = safeJsonParse('{"__proto__":{"isAdmin":true}}');
    expect(parsed.isAdmin).toBeUndefined();
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  });
});

describe('cleanString', () => {
  it('returns empty string for non-strings', () => {
    for (const v of [undefined, null, 5, {}, [], ['a'], true]) {
      expect(cleanString(v, 10)).toBe('');
    }
  });

  it('strips C0 control chars, DEL and C1 control chars', () => {
    expect(cleanString('a\u0000b\u0007c\td\ne\rf\u001fg\u007fh\u0080i\u009fj', 100)).toBe('abcdefghij');
  });

  it('strips U+2028, U+2029 and U+0085', () => {
    expect(cleanString('a b c\u0085d', 100)).toBe('abcd');
  });

  it('truncates to maxLength after stripping', () => {
    expect(cleanString('abcdef', 3)).toBe('abc');
    expect(cleanString('\u0000\u0000abcdef', 3)).toBe('abc');
    expect(cleanString('abc', 10)).toBe('abc');
    expect(cleanString('abc', 0)).toBe('');
  });

  it('keeps ordinary unicode letters and spaces', () => {
    expect(cleanString('čšž ok', 20)).toBe('čšž ok');
  });

  it('leaves HTML as plain text (escaping is the UI job)', () => {
    expect(cleanString('<b>x</b>', 20)).toBe('<b>x</b>');
    expect(cleanString('<script>alert(1)</script>', 100)).toBe('<script>alert(1)</script>');
  });
});

describe('sanitizeAction: input shape', () => {
  it.each([[null], [undefined], [[]], [[{ type: 'pass', playerId: 1 }]], ['pass'], [42], [true]])(
    'rejects non-object input %j',
    (input) => {
      const result = sanitizeAction(input);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Action must be an object');
    }
  );

  it('rejects unknown, missing and non-string types', () => {
    expect(sanitizeAction({ type: 'hack' })).toEqual({ ok: false, error: 'Action type is not allowed' });
    expect(sanitizeAction({}).ok).toBe(false);
    expect(sanitizeAction({ type: 5 }).ok).toBe(false);
    expect(sanitizeAction({ type: null }).ok).toBe(false);
    expect(sanitizeAction({ type: ['pass'] }).ok).toBe(false);
    expect(sanitizeAction({ type: 'PASS', playerId: 1 }).ok).toBe(false);
    expect(sanitizeAction({ type: 'toString' }).ok).toBe(false);
  });

  it('never returns a result containing the error and an action together', () => {
    const bad = sanitizeAction({ type: 'pass', playerId: 0 });
    expect(bad.ok).toBe(false);
    expect(bad.action).toBeUndefined();
    const good = sanitizeAction({ type: 'pass', playerId: 1 });
    expect(good.ok).toBe(true);
    expect(good.error).toBeUndefined();
  });
});

describe('sanitizeAction: place-tile', () => {
  const valid = { type: 'place-tile', playerId: 2, rackIndex: 3, row: 7, col: 8 };

  it('rebuilds a valid action exactly', () => {
    expect(sanitizeAction(valid)).toEqual({
      ok: true,
      action: { type: 'place-tile', playerId: 2, rackIndex: 3, row: 7, col: 8 },
    });
  });

  it('keeps an advisory letter and chosenLetter', () => {
    expect(sanitizeAction({ ...valid, letter: 'a', chosenLetter: 'z' }).action).toEqual({
      type: 'place-tile', playerId: 2, rackIndex: 3, row: 7, col: 8, letter: 'a', chosenLetter: 'z',
    });
  });

  it('accepts a blank letter ("") but omits empty/null chosenLetter', () => {
    expect(sanitizeAction({ ...valid, letter: '' }).action).toEqual({ ...valid, letter: '' });
    expect(sanitizeAction({ ...valid, chosenLetter: '' }).action).toEqual(valid);
    expect(sanitizeAction({ ...valid, chosenLetter: null }).action).toEqual(valid);
  });

  it('accepts boundary values', () => {
    expect(sanitizeAction({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 0, col: 0 }).ok).toBe(true);
    expect(sanitizeAction({ type: 'place-tile', playerId: 4, rackIndex: 6, row: 14, col: 14 }).ok).toBe(true);
  });

  it('drops unknown extra fields', () => {
    const result = sanitizeAction({ ...valid, admin: true, __proto__: { x: 1 }, extra: 'z', nested: { a: 1 } });
    expect(result.ok).toBe(true);
    expect(result.action).toEqual({ type: 'place-tile', playerId: 2, rackIndex: 3, row: 7, col: 8 });
    expect(Object.keys(result.action).sort()).toEqual(['col', 'playerId', 'rackIndex', 'row', 'type']);
  });

  it.each([
    ['missing playerId', { rackIndex: 0, row: 7, col: 7 }],
    ['missing rackIndex', { playerId: 1, row: 7, col: 7 }],
    ['missing row', { playerId: 1, rackIndex: 0, col: 7 }],
    ['missing col', { playerId: 1, rackIndex: 0, row: 7 }],
    ['row 15', { playerId: 1, rackIndex: 0, row: 15, col: 7 }],
    ['row -1', { playerId: 1, rackIndex: 0, row: -1, col: 7 }],
    ['col 15', { playerId: 1, rackIndex: 0, row: 7, col: 15 }],
    ['col -1', { playerId: 1, rackIndex: 0, row: 7, col: -1 }],
    ['rackIndex 7', { playerId: 1, rackIndex: 7, row: 7, col: 7 }],
    ['rackIndex -1', { playerId: 1, rackIndex: -1, row: 7, col: 7 }],
    ['playerId 0', { playerId: 0, rackIndex: 0, row: 7, col: 7 }],
    ['playerId 5', { playerId: 5, rackIndex: 0, row: 7, col: 7 }],
    ['non-integer row', { playerId: 1, rackIndex: 0, row: 7.5, col: 7 }],
    ['non-integer col', { playerId: 1, rackIndex: 0, row: 7, col: 0.1 }],
    ['string row', { playerId: 1, rackIndex: 0, row: '7', col: 7 }],
    ['string playerId', { playerId: '1', rackIndex: 0, row: 7, col: 7 }],
    ['null row', { playerId: 1, rackIndex: 0, row: null, col: 7 }],
    ['NaN col', { playerId: 1, rackIndex: 0, row: 7, col: NaN }],
    ['Infinity row', { playerId: 1, rackIndex: 0, row: Infinity, col: 7 }],
    ['uppercase letter', { playerId: 1, rackIndex: 0, row: 7, col: 7, letter: 'A' }],
    ['multi-char letter', { playerId: 1, rackIndex: 0, row: 7, col: 7, letter: 'ab' }],
    ['numeric letter', { playerId: 1, rackIndex: 0, row: 7, col: 7, letter: 5 }],
    ['null letter', { playerId: 1, rackIndex: 0, row: 7, col: 7, letter: null }],
    ['digit letter', { playerId: 1, rackIndex: 0, row: 7, col: 7, letter: '1' }],
    ['uppercase chosenLetter', { playerId: 1, rackIndex: 0, row: 7, col: 7, chosenLetter: 'Q' }],
    ['multi-char chosenLetter', { playerId: 1, rackIndex: 0, row: 7, col: 7, chosenLetter: 'qq' }],
    ['numeric chosenLetter', { playerId: 1, rackIndex: 0, row: 7, col: 7, chosenLetter: 3 }],
  ])('rejects %s', (_label, fields) => {
    const result = sanitizeAction({ type: 'place-tile', ...fields });
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('accepts lowercase non-ascii letters (language check is the engine job)', () => {
    expect(sanitizeAction({ ...valid, chosenLetter: 'č' }).action.chosenLetter).toBe('č');
  });
});

describe('sanitizeAction: set-blank-letter', () => {
  const valid = { type: 'set-blank-letter', row: 3, col: 4, chosenLetter: 'e' };

  it('rebuilds a valid action exactly and drops extras', () => {
    expect(sanitizeAction({ ...valid, playerId: 1, junk: 1 })).toEqual({
      ok: true,
      action: { type: 'set-blank-letter', row: 3, col: 4, chosenLetter: 'e' },
    });
  });

  it.each([
    ['missing chosenLetter', { row: 3, col: 4 }],
    ['empty chosenLetter', { row: 3, col: 4, chosenLetter: '' }],
    ['null chosenLetter', { row: 3, col: 4, chosenLetter: null }],
    ['uppercase chosenLetter', { row: 3, col: 4, chosenLetter: 'E' }],
    ['multi-char chosenLetter', { row: 3, col: 4, chosenLetter: 'ee' }],
    ['digit chosenLetter', { row: 3, col: 4, chosenLetter: '7' }],
    ['row 15', { row: 15, col: 4, chosenLetter: 'e' }],
    ['col -1', { row: 3, col: -1, chosenLetter: 'e' }],
    ['missing row', { col: 4, chosenLetter: 'e' }],
    ['missing col', { row: 3, chosenLetter: 'e' }],
    ['float col', { row: 3, col: 1.5, chosenLetter: 'e' }],
    ['string row', { row: '3', col: 4, chosenLetter: 'e' }],
  ])('rejects %s', (_label, fields) => {
    expect(sanitizeAction({ type: 'set-blank-letter', ...fields }).ok).toBe(false);
  });
});

describe.each(['recall', 'play-word', 'pass'])('sanitizeAction: %s', (type) => {
  it('rebuilds a valid action exactly and drops extras', () => {
    expect(sanitizeAction({ type, playerId: 3, evil: 'x', row: 1 })).toEqual({ ok: true, action: { type, playerId: 3 } });
  });

  it.each([1, 2, 3, 4])('accepts playerId %i', (playerId) => {
    expect(sanitizeAction({ type, playerId })).toEqual({ ok: true, action: { type, playerId } });
  });

  it.each([
    ['missing playerId', {}],
    ['playerId 0', { playerId: 0 }],
    ['playerId 5', { playerId: 5 }],
    ['playerId -1', { playerId: -1 }],
    ['float playerId', { playerId: 1.5 }],
    ['string playerId', { playerId: '2' }],
    ['null playerId', { playerId: null }],
    ['array playerId', { playerId: [1] }],
    ['boolean playerId', { playerId: true }],
  ])('rejects %s', (_label, fields) => {
    expect(sanitizeAction({ type, ...fields }).ok).toBe(false);
  });
});

describe('sanitizeAction: exchange-tiles', () => {
  it('rebuilds a valid action exactly and drops extras', () => {
    expect(sanitizeAction({ type: 'exchange-tiles', playerId: 1, indices: [0, 3, 6], note: 'x' })).toEqual({
      ok: true,
      action: { type: 'exchange-tiles', playerId: 1, indices: [0, 3, 6] },
    });
  });

  it('accepts all 7 distinct indices', () => {
    const indices = [0, 1, 2, 3, 4, 5, 6];
    expect(sanitizeAction({ type: 'exchange-tiles', playerId: 1, indices }).action.indices).toEqual(indices);
  });

  it('copies the indices array (does not alias the input)', () => {
    const indices = [1, 2];
    const { action } = sanitizeAction({ type: 'exchange-tiles', playerId: 1, indices });
    expect(action.indices).not.toBe(indices);
    expect(action.indices).toEqual([1, 2]);
  });

  it.each([
    ['missing indices', { playerId: 1 }],
    ['empty indices', { playerId: 1, indices: [] }],
    ['non-array indices', { playerId: 1, indices: '012' }],
    ['object indices', { playerId: 1, indices: { 0: 1, length: 1 } }],
    ['duplicate indices', { playerId: 1, indices: [2, 2] }],
    ['8 indices', { playerId: 1, indices: [0, 1, 2, 3, 4, 5, 6, 0] }],
    ['index 7', { playerId: 1, indices: [7] }],
    ['index -1', { playerId: 1, indices: [-1] }],
    ['float index', { playerId: 1, indices: [1.5] }],
    ['string index', { playerId: 1, indices: ['1'] }],
    ['null index', { playerId: 1, indices: [null] }],
    ['missing playerId', { indices: [0] }],
    ['playerId 0', { playerId: 0, indices: [0] }],
    ['playerId 5', { playerId: 5, indices: [0] }],
  ])('rejects %s', (_label, fields) => {
    expect(sanitizeAction({ type: 'exchange-tiles', ...fields }).ok).toBe(false);
  });
});

describe('sanitizeAction: reorder-rack', () => {
  it('rebuilds a valid action exactly (including blanks) and drops extras', () => {
    expect(sanitizeAction({ type: 'reorder-rack', playerId: 2, newRack: ['a', '', 'z'], extra: 1 })).toEqual({
      ok: true,
      action: { type: 'reorder-rack', playerId: 2, newRack: ['a', '', 'z'] },
    });
  });

  it('accepts an empty rack and a 7-tile rack', () => {
    expect(sanitizeAction({ type: 'reorder-rack', playerId: 1, newRack: [] }).action.newRack).toEqual([]);
    const rack = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(sanitizeAction({ type: 'reorder-rack', playerId: 1, newRack: rack }).action.newRack).toEqual(rack);
  });

  it.each([
    ['missing newRack', { playerId: 1 }],
    ['string newRack', { playerId: 1, newRack: 'abc' }],
    ['8 tiles', { playerId: 1, newRack: ['a', 'a', 'a', 'a', 'a', 'a', 'a', 'a'] }],
    ['uppercase tile', { playerId: 1, newRack: ['A'] }],
    ['multi-char tile', { playerId: 1, newRack: ['ab'] }],
    ['numeric tile', { playerId: 1, newRack: [1] }],
    ['null tile', { playerId: 1, newRack: [null] }],
    ['digit tile', { playerId: 1, newRack: ['5'] }],
    ['missing playerId', { newRack: ['a'] }],
    ['playerId 5', { playerId: 5, newRack: ['a'] }],
    ['playerId 0', { playerId: 0, newRack: ['a'] }],
  ])('rejects %s', (_label, fields) => {
    expect(sanitizeAction({ type: 'reorder-rack', ...fields }).ok).toBe(false);
  });
});

describe('sanitizeAction: update-viewport', () => {
  it('rebuilds a valid action exactly and drops extras (also nested)', () => {
    expect(
      sanitizeAction({ type: 'update-viewport', viewportCenter: { row: 4, col: 10, zoom: 3 }, other: 1 })
    ).toEqual({ ok: true, action: { type: 'update-viewport', viewportCenter: { row: 4, col: 10 } } });
  });

  it('accepts the corners', () => {
    expect(sanitizeAction({ type: 'update-viewport', viewportCenter: { row: 0, col: 14 } }).ok).toBe(true);
    expect(sanitizeAction({ type: 'update-viewport', viewportCenter: { row: 14, col: 0 } }).ok).toBe(true);
  });

  it.each([
    ['missing viewportCenter', {}],
    ['null viewportCenter', { viewportCenter: null }],
    ['array viewportCenter', { viewportCenter: [1, 2] }],
    ['string viewportCenter', { viewportCenter: '7,7' }],
    ['row 15', { viewportCenter: { row: 15, col: 7 } }],
    ['col -1', { viewportCenter: { row: 7, col: -1 } }],
    ['missing col', { viewportCenter: { row: 7 } }],
    ['missing row', { viewportCenter: { col: 7 } }],
    ['float row', { viewportCenter: { row: 7.2, col: 7 } }],
    ['string col', { viewportCenter: { row: 7, col: '7' } }],
  ])('rejects %s', (_label, fields) => {
    expect(sanitizeAction({ type: 'update-viewport', ...fields }).ok).toBe(false);
  });
});

describe('sanitizeAction: update-dictionary', () => {
  it('rebuilds a valid action exactly with all three keys as booleans', () => {
    expect(
      sanitizeAction({ type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: false, slovenian: true } })
    ).toEqual({
      ok: true,
      action: { type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: false, slovenian: true } },
    });
  });

  it('fills missing keys with false, coerces only literal true, drops unknown keys', () => {
    expect(
      sanitizeAction({
        type: 'update-dictionary',
        dictionaries: { csw21: 'yes', nwl2023: true, evil: true, slovenian: 1 },
        extra: 1,
      })
    ).toEqual({
      ok: true,
      action: { type: 'update-dictionary', dictionaries: { csw21: false, nwl2023: true, slovenian: false } },
    });
  });

  it.each([
    ['missing dictionaries', {}],
    ['null dictionaries', { dictionaries: null }],
    ['array dictionaries', { dictionaries: [true] }],
    ['string dictionaries', { dictionaries: 'csw21' }],
    ['empty selection', { dictionaries: {} }],
    ['all false', { dictionaries: { csw21: false, nwl2023: false, slovenian: false } }],
    ['only unknown keys', { dictionaries: { other: true } }],
    ['truthy non-true values only', { dictionaries: { csw21: 1, nwl2023: 'true', slovenian: {} } }],
  ])('rejects %s', (_label, fields) => {
    const result = sanitizeAction({ type: 'update-dictionary', ...fields });
    expect(result.ok).toBe(false);
  });

  it('gives a clear message for an empty selection', () => {
    expect(sanitizeAction({ type: 'update-dictionary', dictionaries: {} }).error).toBe('Select at least one dictionary');
  });
});

describe('sanitizeAction: restart', () => {
  it('accepts a bare restart', () => {
    expect(sanitizeAction({ type: 'restart' })).toEqual({ ok: true, action: { type: 'restart' } });
  });

  it('rebuilds playerCount and language exactly and drops extras', () => {
    expect(sanitizeAction({ type: 'restart', playerCount: 3, language: 'slovenian', foo: 1 })).toEqual({
      ok: true,
      action: { type: 'restart', playerCount: 3, language: 'slovenian' },
    });
  });

  it.each([2, 3, 4])('accepts playerCount %i', (playerCount) => {
    expect(sanitizeAction({ type: 'restart', playerCount }).action).toEqual({ type: 'restart', playerCount });
  });

  it.each(['english', 'slovenian'])('accepts language %s', (language) => {
    expect(sanitizeAction({ type: 'restart', language }).action).toEqual({ type: 'restart', language });
  });

  it.each([
    ['playerCount 1', { playerCount: 1 }],
    ['playerCount 5', { playerCount: 5 }],
    ['playerCount 0', { playerCount: 0 }],
    ['playerCount float', { playerCount: 2.5 }],
    ['playerCount string', { playerCount: '3' }],
    ['playerCount null', { playerCount: null }],
    ['unknown language', { language: 'klingon' }],
    ['uppercase language', { language: 'English' }],
    ['null language', { language: null }],
    ['numeric language', { language: 1 }],
    ['__proto__-ish language', { language: 'constructor' }],
    ['good count, bad language', { playerCount: 2, language: 'xx' }],
  ])('rejects %s', (_label, fields) => {
    expect(sanitizeAction({ type: 'restart', ...fields }).ok).toBe(false);
  });
});

describe('sanitizeAction: validate-word', () => {
  it('rebuilds a valid action exactly and drops extras', () => {
    expect(sanitizeAction({ type: 'validate-word', word: 'cat', x: 1 })).toEqual({
      ok: true,
      action: { type: 'validate-word', word: 'cat' },
    });
  });

  it('accepts unicode letters, uppercase and a 25-letter word', () => {
    expect(sanitizeAction({ type: 'validate-word', word: 'ČŠŽ' }).action.word).toBe('ČŠŽ');
    expect(sanitizeAction({ type: 'validate-word', word: 'a'.repeat(25) }).ok).toBe(true);
    expect(sanitizeAction({ type: 'validate-word', word: 'a' }).ok).toBe(true);
  });

  it.each([
    ['missing word', {}],
    ['empty word', { word: '' }],
    ['26 letters', { word: 'a'.repeat(26) }],
    ['digits', { word: 'abc1' }],
    ['only digits', { word: '123' }],
    ['space inside', { word: 'a b' }],
    ['leading space', { word: ' cat' }],
    ['trailing newline', { word: 'cat\n' }],
    ['punctuation', { word: "ca't" }],
    ['hyphen', { word: 'a-b' }],
    ['html', { word: '<b>' }],
    ['number type', { word: 123 }],
    ['null', { word: null }],
    ['array', { word: ['cat'] }],
  ])('rejects %s', (_label, fields) => {
    expect(sanitizeAction({ type: 'validate-word', ...fields }).ok).toBe(false);
  });
});

describe('sanitizeAction: hostile objects', () => {
  it('does not pollute prototypes and ignores inherited fields', () => {
    const raw = JSON.parse('{"type":"pass","playerId":1,"__proto__":{"polluted":true}}');
    const result = sanitizeAction(raw);
    expect(result).toEqual({ ok: true, action: { type: 'pass', playerId: 1 } });
    expect({}.polluted).toBeUndefined();
  });

  it('returns a fresh object, not the caller object', () => {
    const raw = { type: 'pass', playerId: 1 };
    const result = sanitizeAction(raw);
    expect(result.action).not.toBe(raw);
  });
});

describe('sanitizeGameState: valid states', () => {
  it.each([2, 3, 4])('a real %i-player state survives a JSON round trip unchanged', (playerCount) => {
    const original = realState(playerCount);
    expect(Object.keys(original).filter((k) => /^player\d$/.test(k))).toHaveLength(playerCount);
    const sanitized = sanitizeGameState(original);
    expect(sanitized).toEqual(original);
    const result = trySanitizeGameState(original);
    expect(result.ok).toBe(true);
    expect(result.state).toEqual(original);
  });

  it('returns new objects rather than aliasing the input', () => {
    const original = realState(2);
    const sanitized = sanitizeGameState(original);
    expect(sanitized).not.toBe(original);
    expect(sanitized.board).not.toBe(original.board);
    expect(sanitized.player1).not.toBe(original.player1);
    expect(sanitized.player1.rack).not.toBe(original.player1.rack);
  });

  it('accepts a mid-game state with played tiles, blanks and history', () => {
    const engine = makeEngine();
    engine.dispatch({ type: 'restart', playerCount: 2 });
    engine.debugSetRack(1, ['c', 'a', 't', '', 'x', 'y', 'z']);
    engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 6 });
    engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 7 });
    engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 8, chosenLetter: 'q' }); // chosenLetter is ignored for a non-blank tile
    engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 9, chosenLetter: 'k' }); // blank
    const midTurn = engine.getState();
    expect(midTurn.board[7][9].isBlank).toBe(true);
    const copy = clone(midTurn);
    expect(sanitizeGameState(copy)).toEqual(copy);
    engine.dispatch({ type: 'play-word', playerId: 1 }); // "catk" not in dict -> invalid history entry
    const afterInvalid = clone(engine.getState());
    expect(afterInvalid.player1.history).toHaveLength(1);
    expect(sanitizeGameState(afterInvalid)).toEqual(afterInvalid);
  });

  it('accepts a finished game with finalScores', () => {
    const state = realState(2);
    state.gameOver = true;
    state.winner = 1;
    state.finalScores = { player1: 20, player1Remaining: 0, player2: 5, player2Remaining: 15 };
    expect(sanitizeGameState(state)).toEqual(state);
  });

  it('accepts a tie (winner 0)', () => {
    const state = realState(2);
    state.gameOver = true;
    state.winner = 0;
    expect(sanitizeGameState(state).winner).toBe(0);
  });
});

describe('sanitizeGameState: rejections', () => {
  const rejects = (mutate, playerCount = 4) => {
    const state = realState(playerCount);
    mutate(state);
    expect(() => sanitizeGameState(state)).toThrow(ProtocolError);
    const result = trySanitizeGameState(state);
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.state).toBeUndefined();
  };

  it.each([[null], [undefined], [[]], ['state'], [7]])('rejects non-object %j', (input) => {
    expect(() => sanitizeGameState(input)).toThrow('Game state must be an object');
    expect(trySanitizeGameState(input)).toEqual({ ok: false, error: 'Game state must be an object' });
  });

  it('rejects a board with 14 rows', () => rejects((s) => s.board.pop()));
  it('rejects a board with 16 rows', () => rejects((s) => s.board.push(clone(s.board[0]))));
  it('rejects a row with 14 cells', () => rejects((s) => s.board[3].pop()));
  it('rejects a row with 16 cells', () => rejects((s) => s.board[3].push(clone(s.board[3][0]))));
  it('rejects a non-array board', () => rejects((s) => { s.board = {}; }));
  it('rejects a missing board', () => rejects((s) => { delete s.board; }));
  it('rejects a non-array row', () => rejects((s) => { s.board[0] = 'x'; }));
  it('rejects a null cell', () => rejects((s) => { s.board[2][2] = null; }));
  it('rejects playerCount 5', () => rejects((s) => { s.playerCount = 5; }));
  it('rejects playerCount 1', () => rejects((s) => { s.playerCount = 1; }));
  it('rejects a non-integer playerCount', () => rejects((s) => { s.playerCount = '4'; }));
  it('rejects currentPlayer 0', () => rejects((s) => { s.currentPlayer = 0; }));
  it('rejects currentPlayer above playerCount', () => rejects((s) => { s.currentPlayer = 3; }, 2));
  it('rejects an unknown language', () => rejects((s) => { s.language = 'klingon'; }));
  it('rejects a missing language', () => rejects((s) => { delete s.language; }));
  it("rejects cell type 'xx'", () => rejects((s) => { s.board[0][0].type = 'xx'; }));
  it('rejects a cell letter of 2 chars', () => rejects((s) => { s.board[5][5].letter = 'ab'; }));
  it('rejects an uppercase cell letter', () => rejects((s) => { s.board[5][5].letter = 'A'; }));
  it('rejects a 2-char chosenLetter', () => rejects((s) => { s.board[5][5].chosenLetter = 'zz'; }));
  it('rejects a missing player2', () => rejects((s) => { delete s.player2; }));
  it('rejects a missing viewportCenter', () => rejects((s) => { delete s.viewportCenter; }));
  it('rejects an out-of-range viewportCenter', () => rejects((s) => { s.viewportCenter.row = 15; }));
  it('rejects a rack with 8 tiles', () => rejects((s) => { s.player1.rack = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']; }));
  it('rejects a rack with a bad tile', () => rejects((s) => { s.player1.rack[0] = 'AB'; }));
  it('rejects a non-array rack', () => rejects((s) => { s.player1.rack = 'abc'; }));
  it('rejects a history of 1001 entries', () =>
    rejects((s) => {
      s.player1.history = Array.from({ length: 1001 }, (_, i) => ({ turnNumber: i + 1, action: 'pass', totalScore: 0 }));
    }));
  it('rejects a non-array history', () => rejects((s) => { s.player1.history = {}; }));
  it('rejects a history entry without turnNumber', () => rejects((s) => { s.player1.history = [{ totalScore: 0 }]; }));
  it('rejects a history entry with too many words', () =>
    rejects((s) => {
      const words = Array.from({ length: 16 }, () => ({ word: 'cat', score: 1, definition: '' }));
      s.player1.history = [{ turnNumber: 1, totalScore: 16, words }];
    }));
  it('rejects a history entry with count above 7', () =>
    rejects((s) => { s.player1.history = [{ turnNumber: 1, action: 'exchange', count: 8, totalScore: 0 }]; }));
  it('rejects a history entry with a negative bingoBonus', () =>
    rejects((s) => { s.player1.history = [{ turnNumber: 1, bingoBonus: -1, totalScore: 0 }]; }));
  it('rejects a non-numeric score', () => rejects((s) => { s.player1.score = 'lots'; }));
  it('rejects an absurd score', () => rejects((s) => { s.player1.score = 1e9; }));
  it('rejects an invalid messageType', () => rejects((s) => { s.messageType = 'danger'; }));
  it('rejects a tileBag with more than 200 tiles', () => rejects((s) => { s.tileBag = Array(201).fill('a'); }));
  it('rejects a tileBag containing bad tiles', () => rejects((s) => { s.tileBag[0] = 'Q'; }));
  it('rejects a winner above playerCount', () => rejects((s) => { s.winner = 3; }, 2));
  it('rejects consecutivePasses above 100', () => rejects((s) => { s.consecutivePasses = 101; }));
  it('rejects a malformed player', () => rejects((s) => { s.player3 = 'nope'; }));
});

describe('sanitizeGameState: field dropping, truncation and cleaning', () => {
  it('drops extra top-level and nested fields', () => {
    const original = realState(2);
    const dirty = clone(original);
    dirty.evil = { deep: true };
    dirty.player3 = { playerName: 'ghost', rack: [], score: 0, history: [], isCurrentPlayer: false }; // beyond playerCount
    dirty.viewportCenter.zoom = 5;
    dirty.board[0][0].secret = 1;
    dirty.player1.cheat = 'yes';
    dirty.player1.history = [
      { turnNumber: 1, action: 'pass', totalScore: 0, junk: 1 },
      { turnNumber: 2, totalScore: 3, words: [{ word: 'cat', score: 3, definition: 'a pet', extra: 1 }], bingoBonus: 0 },
    ];
    dirty.finalScores = { player1: 1, player1Remaining: 0, player2: 2, player2Remaining: 0, player9: 5 };

    const clean = sanitizeGameState(dirty);
    expect(clean.evil).toBeUndefined();
    expect(clean.player3).toBeUndefined();
    expect(clean.viewportCenter).toEqual({ row: 7, col: 7 });
    expect(Object.keys(clean.board[0][0]).sort()).toEqual(['chosenLetter', 'isBlank', 'isNew', 'letter', 'locked', 'type']);
    expect(clean.player1.cheat).toBeUndefined();
    expect(Object.keys(clean.player1).sort()).toEqual(['history', 'isCurrentPlayer', 'playerName', 'rack', 'score']);
    expect(clean.player1.history).toEqual([
      { turnNumber: 1, action: 'pass', totalScore: 0 },
      { turnNumber: 2, totalScore: 3, bingoBonus: 0, words: [{ word: 'cat', score: 3, definition: 'a pet' }] },
    ]);
    expect(clean.finalScores).toEqual({ player1: 1, player1Remaining: 0, player2: 2, player2Remaining: 0 });
    expect(Object.keys(clean).sort()).toEqual(
      [
        'board', 'consecutivePasses', 'currentPlayer', 'dictionaries', 'finalScores', 'gameId', 'gameOver', 'language',
        'message', 'messageType', 'playerCount', 'player1', 'player2', 'tileBag', 'viewportCenter', 'winner',
      ].sort()
    );
  });

  it('truncates long strings and strips control characters', () => {
    const state = realState(2);
    state.message = 'M\u0000' + 'x'.repeat(500);
    state.gameId = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    state.player1.playerName = 'N'.repeat(50);
    state.player2.playerName = 'Bo b \u0085by';
    state.player1.history = [
      {
        turnNumber: 1,
        action: 'a'.repeat(30),
        totalScore: 0,
        timestamp: 't'.repeat(60),
        words: [{ word: 'w'.repeat(40), score: 1, definition: 'D\u0007' + 'd'.repeat(700) }],
      },
    ];
    const clean = sanitizeGameState(state);
    expect(clean.message).toBe('M' + 'x'.repeat(299)); // control char removed first, then cut to 300
    expect(clean.message).toHaveLength(300);
    expect(clean.gameId).toBe('ABCDEFGHIJKLMNOP');
    expect(clean.player1.playerName).toBe('N'.repeat(30));
    expect(clean.player2.playerName).toBe('Bobby');
    const entry = clean.player1.history[0];
    expect(entry.action).toBe('a'.repeat(20));
    expect(entry.timestamp).toBe('t'.repeat(40));
    expect(entry.words[0].word).toBe('w'.repeat(25));
    expect(entry.words[0].definition).toBe('D' + 'd'.repeat(599));
    expect(entry.words[0].definition).toHaveLength(600);
  });

  it('keeps HTML in strings as text', () => {
    const state = realState(2);
    state.message = '<img src=x onerror=alert(1)>';
    expect(sanitizeGameState(state).message).toBe('<img src=x onerror=alert(1)>');
  });

  it('turns non-string message / name / gameId into empty strings', () => {
    const state = realState(2);
    state.message = { a: 1 };
    state.gameId = 123;
    state.player1.playerName = null;
    const clean = sanitizeGameState(state);
    expect(clean.message).toBe('');
    expect(clean.gameId).toBe('');
    expect(clean.player1.playerName).toBe('');
  });

  it('coerces booleans strictly: only literal true counts', () => {
    const state = realState(2);
    state.gameOver = 'true';
    state.board[0][0].isNew = 1;
    state.board[0][0].locked = 'yes';
    state.player1.isCurrentPlayer = 'true';
    state.dictionaries = { csw21: 1, nwl2023: true, slovenian: 'x', other: true };
    const clean = sanitizeGameState(state);
    expect(clean.gameOver).toBe(false);
    expect(clean.board[0][0].isNew).toBe(false);
    expect(clean.board[0][0].locked).toBe(false);
    expect(clean.player1.isCurrentPlayer).toBe(false);
    expect(clean.dictionaries).toEqual({ csw21: false, nwl2023: true, slovenian: false });
  });

  it('applies defaults for optional fields', () => {
    const state = realState(2);
    delete state.consecutivePasses;
    delete state.tileBag;
    delete state.messageType;
    delete state.finalScores;
    delete state.winner;
    delete state.dictionaries;
    const clean = sanitizeGameState(state);
    expect(clean.consecutivePasses).toBe(0);
    expect(clean.tileBag).toEqual([]);
    expect(clean.messageType).toBe('');
    expect(clean.finalScores).toBeNull();
    expect(clean.winner).toBeNull();
    expect(clean.dictionaries).toEqual({ csw21: false, nwl2023: false, slovenian: false });
  });

  it('fills missing cell fields with defaults', () => {
    const state = realState(2);
    state.board[1][1] = {};
    expect(sanitizeGameState(state).board[1][1]).toEqual({
      letter: '', type: '', isNew: false, locked: false, isBlank: false, chosenLetter: '',
    });
  });

  it('accepts a cell holding a blank with a chosen letter', () => {
    const state = realState(2);
    state.board[7][7] = { letter: '', type: 'center', isNew: true, locked: false, isBlank: true, chosenLetter: 'e' };
    expect(sanitizeGameState(state).board[7][7]).toEqual(state.board[7][7]);
  });

  it('defaults history totalScore to 0 and word score to 0', () => {
    const state = realState(2);
    state.player1.history = [{ turnNumber: 1, words: [{ word: 'cat', definition: 'x' }] }];
    expect(sanitizeGameState(state).player1.history).toEqual([
      { turnNumber: 1, totalScore: 0, words: [{ word: 'cat', score: 0, definition: 'x' }] },
    ]);
  });
});

describe('sanitizeGameState: finalScores validation', () => {
  const withScores = (scores, playerCount = 2) => {
    const state = realState(playerCount);
    state.finalScores = scores;
    return state;
  };

  it('treats null and undefined as no scores', () => {
    expect(sanitizeGameState(withScores(null)).finalScores).toBeNull();
    expect(sanitizeGameState(withScores(undefined)).finalScores).toBeNull();
  });

  it('defaults a missing Remaining value to 0', () => {
    const clean = sanitizeGameState(withScores({ player1: 10, player2: 4 }));
    expect(clean.finalScores).toEqual({ player1: 10, player1Remaining: 0, player2: 4, player2Remaining: 0 });
  });

  it('only keeps entries for existing players (4-player)', () => {
    const scores = {};
    for (let i = 1; i <= 4; i++) {
      scores[`player${i}`] = i * 10;
      scores[`player${i}Remaining`] = i;
    }
    expect(sanitizeGameState(withScores(scores, 4)).finalScores).toEqual(scores);
  });

  it('allows a negative final score', () => {
    expect(sanitizeGameState(withScores({ player1: -5, player2: 1 })).finalScores.player1).toBe(-5);
  });

  it.each([
    ['string', 'scores'],
    ['array', [1, 2]],
    ['number', 5],
    ['missing player2', { player1: 1, player1Remaining: 0 }],
    ['missing player1', { player2: 1 }],
    ['non-integer score', { player1: 1.5, player2: 2 }],
    ['string score', { player1: '1', player2: 2 }],
    ['score above range', { player1: 100001, player2: 2 }],
    ['score below range', { player1: -100001, player2: 2 }],
    ['negative Remaining', { player1: 1, player1Remaining: -1, player2: 2 }],
    ['Remaining above 1000', { player1: 1, player2: 2, player2Remaining: 1001 }],
    ['Remaining non-integer', { player1: 1, player2: 2, player2Remaining: 0.5 }],
  ])('rejects %s', (_label, scores) => {
    const result = trySanitizeGameState(withScores(scores));
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('requires player3/player4 scores when playerCount is 4', () => {
    const result = trySanitizeGameState(withScores({ player1: 1, player2: 2 }, 4));
    expect(result.ok).toBe(false);
  });
});

describe('trySanitizeGameState', () => {
  it('returns ok:true with the sanitized state', () => {
    const state = realState(3);
    const result = trySanitizeGameState(state);
    expect(result.ok).toBe(true);
    expect(result.state.playerCount).toBe(3);
    expect(result.error).toBeUndefined();
  });

  it('returns the ProtocolError message instead of throwing', () => {
    const state = realState(3);
    state.playerCount = 9;
    expect(trySanitizeGameState(state)).toEqual({ ok: false, error: 'playerCount must be an integer from 2 to 4' });
  });
});
