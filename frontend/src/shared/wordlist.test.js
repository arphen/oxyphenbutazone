import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateWordListText } from './wordlist.js';
import { parseDictionaryFile } from './dictionary.js';

const ok = (text, options) => {
  const result = validateWordListText(text, options);
  expect(result.ok, JSON.stringify(result).slice(0, 200)).toBe(true);
  return result;
};
const refused = (text, options) => {
  const result = validateWordListText(text, options);
  expect(result.ok).toBe(false);
  expect(typeof result.error).toBe('string');
  expect(result.error.length).toBeGreaterThan(10);
  return result.error;
};

// n distinct valid words: wa, wb, ..., wz, wba, ...
const word = (i) => {
  let s = '';
  do {
    s = String.fromCharCode(97 + (i % 26)) + s;
    i = Math.floor(i / 26);
  } while (i > 0);
  return `w${s}`;
};
const many = (n) => Array.from({ length: n }, (_, i) => word(i)).join('\n');

describe('validateWordListText: accepted input', () => {
  it('accepts bare words and keeps them', () => {
    expect(ok('cat\ndog\nzzyzx')).toEqual({ ok: true, text: 'cat\ndog\nzzyzx', count: 3, skipped: 0 });
  });

  it('accepts `WORD definition` lines and keeps the definition', () => {
    const r = ok('AAH an interjection expressing surprise [interj]\nAAL an East Indian shrub [n -S]');
    expect(r.count).toBe(2);
    expect(r.text.split('\n')[0]).toBe('AAH an interjection expressing surprise [interj]');
    expect(parseDictionaryFile(r.text).get('aah')).toBe('an interjection expressing surprise [interj]');
  });

  it('treats a tab between word and definition as the separator', () => {
    expect(ok('cat\ta small feline').text).toBe('cat a small feline');
  });

  it('strips a BOM and CR characters (CRLF files)', () => {
    const r = ok('﻿cat\r\ndog\r\nbird\r\n');
    expect(r.text).toBe('cat\ndog\nbird');
    expect(r.count).toBe(3);
  });

  it('ignores blank lines without counting them as skipped', () => {
    expect(ok('\n\ncat\n   \n\ndog\n\n')).toMatchObject({ count: 2, skipped: 0, text: 'cat\ndog' });
  });

  it('ignores # comment lines (the CSW21 licence header) without counting them as skipped', () => {
    expect(ok('# Published under license with Collins\naa\nab')).toMatchObject({ count: 2, skipped: 0, text: 'aa\nab' });
  });

  it('accepts words of exactly 2 and exactly 15 letters', () => {
    expect(ok(`ab\n${'a'.repeat(15)}`).count).toBe(2);
  });

  it('accepts non-English letters (Slovenian)', () => {
    const r = ok('čaj\nšola\nžaba\nkožuh');
    expect(r.count).toBe(4);
    expect(r.text).toBe('čaj\nšola\nžaba\nkožuh');
  });

  it('leaves the case as given', () => {
    expect(ok('CAT\nDog').text).toBe('CAT\nDog');
  });

  it('accepts a file without a trailing newline', () => {
    expect(ok('cat\ndog').count).toBe(2);
  });

  it('keeps duplicates (the store collapses them on load)', () => {
    const r = ok('cat\ncat\ndog');
    expect(r.count).toBe(3);
    expect(parseDictionaryFile(r.text).size).toBe(2);
  });
});

describe('validateWordListText: skipping bad lines', () => {
  it('skips and counts invalid lines and leaves them out of the cleaned text', () => {
    const r = ok(`${many(100)}\nx\n1234\nhello-world`);
    expect(r.count).toBe(100);
    expect(r.skipped).toBe(3);
    expect(r.text.split('\n')).toHaveLength(100);
    expect(r.text).not.toContain('1234');
    expect(r.text).not.toContain('hello-world');
  });

  it('skips a one-letter word, a 16-letter word, digits, punctuation and a leading non-word token', () => {
    const r = ok(`${many(200)}\na\n${'a'.repeat(16)}\nab1\nab-cd\n(ab) text\n42 text\n`);
    expect(r.skipped).toBe(6);
    expect(r.count).toBe(200);
  });

  it('exactly 5% invalid is accepted, just over 5% is refused', () => {
    const good = many(95);
    expect(ok(`${good}\n1\n2\n3\n4\n5`).skipped).toBe(5); // 5 of 100
    refused(`${good}\n1\n2\n3\n4\n5\n6`); // 6 of 101 = 5.9%
  });
});

describe('validateWordListText: definitions', () => {
  it('strips control characters from definitions', () => {
    expect(ok('cat a\u0000small\u0007 feline\u001b x').text).toBe('cat asmall felinex');
  });

  it('caps a definition at 600 characters', () => {
    expect(ok(`cat ${'x'.repeat(5000)}`).text).toBe(`cat ${'x'.repeat(600)}`);
  });

  it('keeps a definition of exactly 600 characters intact', () => {
    const def = 'y'.repeat(600);
    expect(ok(`cat ${def}`).text).toBe(`cat ${def}`);
  });

  it('drops the definition when it is only control characters', () => {
    expect(ok('cat \u0001\u0002').text).toBe('cat');
  });

  it('keeps square-bracket metadata and non-ASCII in definitions', () => {
    expect(ok('cat a 猫 [n -S]').text).toBe('cat a 猫 [n -S]');
  });
});

describe('validateWordListText: refusing files', () => {
  it('refuses an empty file', () => {
    expect(refused('')).toMatch(/empty/i);
  });

  it('refuses a file of only blank lines, whitespace and a BOM', () => {
    expect(refused('﻿\n\r\n   \n\t\n')).toMatch(/empty/i);
  });

  it('refuses a file of only comments', () => {
    expect(refused('# nothing here\n# at all')).toMatch(/empty/i);
  });

  it('refuses non-string input', () => {
    for (const bad of [null, undefined, 42, {}, new Uint8Array(3)]) refused(bad);
  });

  it('refuses an HTML page', () => {
    const html = '<!DOCTYPE html>\n<html>\n<head><title>404</title></head>\n<body>\n<h1>Not found</h1>\n<p>nope</p>\n</body>\n</html>';
    expect(refused(html)).toMatch(/word list/i);
  });

  it('refuses a one-line minified HTML page', () => {
    expect(refused('<!DOCTYPE html><html><body><h1>Hello</h1></body></html>')).toMatch(/word list/i);
  });

  it('refuses a JSON file', () => {
    expect(refused('{\n  "words": ["cat", "dog"],\n  "count": 2\n}')).toMatch(/word list/i);
  });

  it('refuses random binary data decoded as text', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const bytes = new Uint8Array(20000).map(() => Math.floor(rnd() * 256));
    expect(refused(new TextDecoder('utf-8').decode(bytes))).toMatch(/word list/i);
    expect(refused(new TextDecoder('latin1').decode(bytes))).toMatch(/word list/i);
  });

  it('refuses text with NUL bytes and no usable lines', () => {
    refused('\u0000\u0000\u0000\n\u0001\u0002\n');
  });

  it('refuses a file where every line is invalid', () => {
    expect(refused('1\n2\n3\n')).toMatch(/word list/i);
  });

  it('refuses a file with more than 5% invalid lines even if most are valid', () => {
    const lines = Array.from({ length: 100 }, (_, i) => (i % 10 === 0 ? '!!!' : 'cat'));
    expect(refused(lines.join('\n'))).toMatch(/word list/i);
  });

  it('refuses a file over maxBytes and says so', () => {
    expect(refused('cat\n'.repeat(100), { maxBytes: 100 })).toMatch(/too big/i);
  });

  it('measures size in bytes, not characters', () => {
    const text = 'éé\n'.repeat(40); // 200 bytes, 80 characters
    expect(validateWordListText(text, { maxBytes: 150 })).toMatchObject({ ok: false });
    expect(validateWordListText(text, { maxBytes: 150 }).error).toMatch(/too big/i);
    expect(validateWordListText(text, { maxBytes: 200 }).ok).toBe(true);
  });

  it('accepts a file exactly at maxBytes and refuses one byte more', () => {
    const text = 'abcdefghi\n'.repeat(5);
    expect(new TextEncoder().encode(text).length).toBe(50);
    ok(text, { maxBytes: 50 });
    expect(refused(text, { maxBytes: 49 })).toMatch(/too big/i);
  });

  it('refuses a file with too many lines', () => {
    expect(refused('cat\n'.repeat(11), { maxLines: 10 })).toMatch(/too many lines/i);
  });

  it('accepts a file with exactly maxLines lines', () => {
    expect(ok(Array(10).fill('cat').join('\n'), { maxLines: 10 }).count).toBe(10);
  });

  it('counts blank lines against maxLines', () => {
    expect(refused(`cat${'\n'.repeat(20)}`, { maxLines: 10 })).toMatch(/too many lines/i);
  });

  it('error messages are short single sentences', () => {
    const errors = [refused(''), refused('<html>'), refused('cat\n'.repeat(5), { maxBytes: 5 }), refused('cat\n'.repeat(5), { maxLines: 2 })];
    for (const e of errors) {
      expect(e.length).toBeLessThan(160);
      expect(e).not.toMatch(/undefined|NaN|Error:/);
      expect(e).toMatch(/\.$/);
    }
  });
});

describe('validateWordListText: real lists and performance', () => {
  it('accepts the shipped CSW21 file: licence header ignored, every entry kept', () => {
    const raw = readFileSync(new URL('../../public/CSW21.txt', import.meta.url), 'utf8');
    const r = ok(raw);
    expect(r.count).toBeGreaterThan(250000);
    expect(r.skipped).toBe(0);
    const parsed = parseDictionaryFile(r.text);
    expect(parsed.get('aah')).toMatch(/interjection/);
    expect(parsed.size).toBe(parseDictionaryFile(raw.replace(/^#.*\n/gm, '')).size);
  });

  it('accepts the shipped ENABLE (bare words) and Slovenian files', () => {
    expect(ok(readFileSync(new URL('../../public/ENABLE.txt', import.meta.url), 'utf8')).count).toBeGreaterThan(150000);
    expect(ok(readFileSync(new URL('../../public/SLOVENIAN.txt', import.meta.url), 'utf8')).count).toBeGreaterThan(10000);
  });

  it('handles a 30 MB file in a few seconds', () => {
    const line = 'abcdefgh a fairly typical definition of about this length [n -S]\n';
    const text = line.repeat(Math.ceil((30 * 1024 * 1024) / line.length));
    const started = performance.now();
    const r = validateWordListText(text);
    const took = performance.now() - started;
    expect(r.ok).toBe(true); // ~490k lines: under both limits
    expect(took).toBeLessThan(5000);
  });
});
