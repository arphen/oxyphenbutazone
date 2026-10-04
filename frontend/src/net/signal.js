// Pairing blobs. Two devices connect by swapping one text blob each way (an "invite" and an "answer"), shown as a QR
// code or copied/pasted/sent through any messenger. The blob carries a WebRTC session description (SDP) plus a
// little routing info. Everything decoded here comes from the other person's phone (or an attacker's), so it is
// size-capped, parsed safely and the SDP is restricted to a plain data-channel offer before it goes anywhere near
// the browser's WebRTC stack.

import { ProtocolError, safeJsonParse } from '../shared/protocol.js';

export const SIGNAL_PREFIX = 'OXY1.';
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

const toBase64Url = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

const fromBase64Url = (text) => {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) fail('Invite contains invalid characters');
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
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

/** { t: 'offer'|'answer', sdp, room, seat } -> 'OXY1.<compressed base64url>' */
export async function encodeSignal(signal) {
  const json = JSON.stringify({ v: 1, t: signal.t, sdp: signal.sdp, room: signal.room, seat: signal.seat });
  const compressed = await pump(new CompressionStream('deflate-raw'), new TextEncoder().encode(json), MAX_SIGNAL_JSON);
  return SIGNAL_PREFIX + toBase64Url(compressed);
}

/**
 * Parse and validate a pasted/scanned invite or answer. Accepts the bare token or a link containing `c=<token>`.
 * Throws ProtocolError with a message that is safe to show to the user.
 */
export async function decodeSignal(input) {
  if (typeof input !== 'string') fail('Nothing to read');
  let text = input.trim();
  const inLink = /[?&]c=(OXY1\.[A-Za-z0-9_-]+)/.exec(text);
  if (inLink) text = inLink[1];
  if (!text.startsWith(SIGNAL_PREFIX)) fail('That does not look like a game invite');
  if (text.length > MAX_SIGNAL_CHARS) fail('Invite is too large');

  let json;
  try {
    const bytes = await pump(new DecompressionStream('deflate-raw'), fromBase64Url(text.slice(SIGNAL_PREFIX.length)), MAX_SIGNAL_JSON);
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
