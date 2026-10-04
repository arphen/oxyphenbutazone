// Recognise a pairing code in scanned QR text. Pure and cheap: it only checks the shape of the text; decodeSignal
// (signal.js) does the real decoding and validation later.

const TOKEN = /^OXY1\.[A-Za-z0-9_-]+$/;
const LINK = /^https?:\/\/\S*[?&]c=OXY1\.[A-Za-z0-9_-]+(?:[&#]\S*)?$/;

/** The trimmed `OXY1.` token, or the (trimmed) join link carrying `c=OXY1.…`, if `text` is one; otherwise null. */
export function extractCode(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (TOKEN.test(trimmed) || LINK.test(trimmed)) return trimmed;
  return null;
}
