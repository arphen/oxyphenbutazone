// Validation of a word list the player imports from a file. Pure: takes the file's text, returns cleaned text.
//
// A list is one entry per line, either `WORD` or `WORD definition...` (the format of public/CSW21.txt). A word is 2-15
// letters. The file is refused when it is empty, too big, has too many lines, or is mostly not a word list (so a
// random binary, an image or an HTML page is turned away with a friendly message instead of being installed).

import { cleanString } from './protocol.js';

export const MAX_LIST_BYTES = 40 * 1024 * 1024;
export const MAX_LIST_LINES = 700000;
export const MIN_WORD_LENGTH = 2;
export const MAX_WORD_LENGTH = 15;
export const MAX_DEFINITION_LENGTH = 600;
export const MAX_INVALID_SHARE = 0.05;

const WORD = new RegExp(`^\\p{L}{${MIN_WORD_LENGTH},${MAX_WORD_LENGTH}}$`, 'u');
const WHITESPACE = /\s/;

const refuse = (error) => ({ ok: false, error });

function byteLength(text, maxBytes) {
  // A UTF-16 unit is 1-3 UTF-8 bytes: only measure exactly when the cheap bounds cannot decide
  if (text.length > maxBytes) return Infinity;
  if (text.length * 3 <= maxBytes) return 0;
  return new TextEncoder().encode(text).length;
}

/**
 * @returns {{ok: true, text: string, count: number, skipped: number} | {ok: false, error: string}}
 *   count   = valid entries kept; skipped = non-blank, non-comment lines that were not valid entries (left out).
 */
export function validateWordListText(text, { maxBytes = MAX_LIST_BYTES, maxLines = MAX_LIST_LINES } = {}) {
  if (typeof text !== 'string') return refuse('That file could not be read as text.');
  if (byteLength(text, maxBytes) > maxBytes) {
    return refuse(`That file is too big for a word list (the limit is ${Math.round(maxBytes / (1024 * 1024))} MB).`);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const kept = [];
  let lines = 0;
  let nonBlank = 0;
  let skipped = 0;
  let start = 0;
  while (start <= text.length) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    if (++lines > maxLines) return refuse(`That file has too many lines for a word list (the limit is ${maxLines}).`);
    const line = text.slice(start, end).trim(); // trim also drops the CR of CRLF files
    start = end + 1;
    if (!line || line.startsWith('#')) continue; // blank lines and `# comment` lines (CSW21 has a licence header)
    nonBlank++;

    const space = line.search(WHITESPACE);
    const word = space === -1 ? line : line.slice(0, space);
    if (!WORD.test(word)) {
      skipped++;
      continue;
    }
    const definition = space === -1 ? '' : cleanString(line.slice(space + 1), MAX_DEFINITION_LENGTH).trim();
    kept.push(definition ? `${word} ${definition}` : word);
  }

  if (nonBlank === 0) return refuse('That file is empty, so there are no words to import.');
  if (kept.length === 0 || skipped / nonBlank > MAX_INVALID_SHARE) {
    return refuse('That does not look like a word list. It should have one word per line, optionally followed by its definition.');
  }
  return { ok: true, text: kept.join('\n'), count: kept.length, skipped };
}
