// Pairing blobs. Two devices connect by swapping one text blob each way (an "invite" and an "answer"), shown as a QR
// code or copied/pasted/sent through any messenger. The blob carries a WebRTC session description (SDP) plus a
// little routing info. Everything decoded here comes from the other person's phone (or an attacker's), so it is
// size-capped, parsed safely and the SDP is restricted to a plain data-channel offer before it goes anywhere near
// the browser's WebRTC stack.

import { ProtocolError, safeJsonParse } from '../shared/protocol.js';

export const SIGNAL_PREFIX = 'OXY1.';
export const SIGNAL_PREFIX_V2 = 'OXY2.';
export const MAX_SIGNAL_CHARS = 8000; // the encoded text
const MAX_SIGNAL_JSON = 16 * 1024; // after decompression (guards against decompression bombs)
const MAX_SDP_CHARS = 8000;
const MAX_SDP_LINE = 300;
const ALLOWED_LINE_TYPES = new Set(['v', 'o', 's', 't', 'c', 'm', 'a']);
const CANDIDATE =
  /^a=candidate:\S{1,64} \d{1,5} (?:udp|UDP|tcp|TCP) \d{1,10} [A-Za-z0-9.:_-]{1,128} \d{1,5} typ (?:host|srflx|prflx|relay)(?: [A-Za-z0-9.:_ -]*)?$/;

const fail = (message) => {
  throw new ProtocolError(message);
};

const fromBase64Url = (text) => {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) fail('Invite contains invalid characters');
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

// Base32 (RFC 4648, no padding) for new invites. Its alphabet (A-Z, 2-7) is a
// subset of the QR alphanumeric charset, so the QR encoder stores ~5.5 bits per
// character instead of 8 (byte mode, which base64url's lowercase forces). For a
// typical compressed SDP (~500-750 bytes) that drops the QR 2-3 versions
// (e.g. V21 -> V18, ~20% fewer modules per side). It is also URL-safe with no
// escaping, unlike base45 (whose space and % break bare `?c=` links).
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const toBase32 = (bytes) => {
  let bits = 0;
  let nbits = 0;
  let out = '';
  for (const byte of bytes) {
    bits = (bits << 8) | byte;
    nbits += 8;
    while (nbits >= 5) {
      nbits -= 5;
      out += B32_ALPHABET[(bits >> nbits) & 31];
    }
    bits &= (1 << nbits) - 1;
  }
  if (nbits > 0) out += B32_ALPHABET[(bits << (5 - nbits)) & 31];
  return out;
};

const fromBase32 = (text) => {
  if (!/^[A-Z2-7]+$/.test(text)) fail('Invite contains invalid characters');
  if (text.length % 8 === 1) fail('Invite is damaged');
  const out = [];
  let bits = 0;
  let nbits = 0;
  for (const ch of text) {
    bits = (bits << 5) | B32_ALPHABET.indexOf(ch);
    nbits += 5;
    if (nbits >= 8) {
      nbits -= 8;
      out.push((bits >> nbits) & 255);
      bits &= (1 << nbits) - 1;
    }
  }
  if (bits !== 0) fail('Invite is damaged'); // non-zero padding bits
  return Uint8Array.from(out);
};

async function pump(stream, input, maxBytes) {
  const writer = stream.writable.getWriter();
  writer.write(input).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      reader.cancel().catch(() => {});
      fail('Invite is too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Check an SDP from the other side: a data-channel-only session description with sane lines. Returns it unchanged. */
export function validateSdp(sdp) {
  if (typeof sdp !== 'string' || sdp.length === 0 || sdp.length > MAX_SDP_CHARS) fail('Session description has the wrong size');
  const lines = sdp.split('\r\n');
  if (lines.at(-1) === '') lines.pop();
  let mediaLines = 0;
  for (const line of lines) {
    if (line.length > MAX_SDP_LINE || !/^[\x20-\x7e]+$/.test(line)) fail('Session description has an unreadable line');
    if (line[1] !== '=' || !ALLOWED_LINE_TYPES.has(line[0])) fail('Session description has an unexpected line');
    if (line.startsWith('m=')) {
      mediaLines++;
      if (!/^m=application \d+ UDP\/DTLS\/SCTP webrtc-datachannel$/.test(line)) fail('Only a game data channel is allowed');
    }
    if (line.startsWith('a=candidate:') && !CANDIDATE.test(line)) fail('Session description has a malformed candidate');
  }
  if (lines[0] !== 'v=0' || mediaLines !== 1) fail('Session description is not a data-channel offer');
  return sdp;
}

/** { t: 'offer'|'answer', sdp, room, seat } -> 'OXY2.<compressed base32>'.
 *  V2 emits base32 (see above) so the QR stays 2-3 versions smaller than the
 *  legacy OXY1 base64url form. The JSON envelope is unchanged on purpose: the
 *  SDP itself is opaque to us (rewriting it risks WebRTC interop) and shorter
 *  keys would save almost nothing after deflate. */
export async function encodeSignal(signal) {
  const json = JSON.stringify({ v: 1, t: signal.t, sdp: signal.sdp, room: signal.room, seat: signal.seat });
  const compressed = await pump(new CompressionStream('deflate-raw'), new TextEncoder().encode(json), MAX_SIGNAL_JSON);
  return SIGNAL_PREFIX_V2 + toBase32(compressed);
}

/**
 * Parse and validate a pasted/scanned invite or answer. Accepts the bare token or a link containing `c=<token>`.
 * Both OXY2 (base32, current) and OXY1 (base64url, legacy) tokens decode; new invites are always OXY2.
 * Throws ProtocolError with a message that is safe to show to the user.
 */
export async function decodeSignal(input) {
  if (typeof input !== 'string') fail('Nothing to read');
  let text = input.trim();
  const inLink = /[?&]c=(OXY[12]\.[A-Za-z0-9_-]+)/.exec(text);
  if (inLink) text = inLink[1];
  const v2 = text.startsWith(SIGNAL_PREFIX_V2);
  if (!v2 && !text.startsWith(SIGNAL_PREFIX)) fail('That does not look like a game invite');
  if (text.length > MAX_SIGNAL_CHARS) fail('Invite is too large');

  let json;
  try {
    const body = text.slice(SIGNAL_PREFIX_V2.length); // both prefixes are 5 chars
    const raw = v2 ? fromBase32(body) : fromBase64Url(body);
    const bytes = await pump(new DecompressionStream('deflate-raw'), raw, MAX_SIGNAL_JSON);
    json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    if (error instanceof ProtocolError) throw error;
    return fail('Invite is damaged');
  }

  const raw = safeJsonParse(json, MAX_SIGNAL_JSON);
  if (!raw || typeof raw !== 'object' || raw.v !== 1) fail('Invite is from an incompatible version');
  if (raw.t !== 'offer' && raw.t !== 'answer') fail('Invite has an unknown type');
  if (typeof raw.room !== 'string' || !/^[a-z0-9]{6,12}$/.test(raw.room)) fail('Invite has a bad game id');
  if (!Number.isInteger(raw.seat) || raw.seat < 2 || raw.seat > 4) fail('Invite has a bad seat');
  return { t: raw.t, sdp: validateSdp(raw.sdp), room: raw.room, seat: raw.seat };
}
