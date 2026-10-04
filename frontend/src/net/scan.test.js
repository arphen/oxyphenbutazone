import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { extractCode } from './scan.js';
import { encodeSignal, decodeSignal, SIGNAL_PREFIX_V2 } from './signal.js';

// ------------------------------------------------------------------ helpers

// Deterministic pseudo-random so the SDP (and so the token size) is the same on every run.
const rng = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const hex = (next, n) => Array.from({ length: n }, () => Math.floor(next() * 16).toString(16)).join('');
const alnum = (next, n) => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/'[Math.floor(next() * 64)]).join('');

/** A data-channel SDP in the shape Chrome/Safari produce (fingerprint, ice credentials, several candidates). */
function realisticSdp(role, candidateCount = 8) {
  const next = rng(role === 'offer' ? 7 : 11);
  const lines = [
    'v=0',
    'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=extmap-allow-mixed',
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    `a=ice-ufrag:${alnum(next, 4).replace(/[+/]/g, 'x')}`,
    `a=ice-pwd:${alnum(next, 24).replace(/[+/]/g, 'y')}`,
    'a=ice-options:trickle',
    `a=fingerprint:sha-256 ${Array.from({ length: 32 }, () => hex(next, 2).toUpperCase()).join(':')}`,
    `a=setup:${role === 'offer' ? 'actpass' : 'active'}`,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
  ];
  for (let i = 0; i < candidateCount; i++) {
    const kind = i % 4 === 3 ? 'srflx' : 'host';
    const addr = i % 2 === 0 ? `192.168.${Math.floor(next() * 255)}.${Math.floor(next() * 255)}` : `2a02:${hex(next, 4)}:${hex(next, 4)}::${hex(next, 4)}`;
    const raddr = kind === 'srflx' ? ' raddr 0.0.0.0 rport 0' : '';
    lines.push(`a=candidate:${Math.floor(next() * 2 ** 31)} 1 udp ${2113937151 - i * 1000} ${addr} ${40000 + Math.floor(next() * 20000)} typ ${kind}${raddr} generation 0 network-cost 999`);
  }
  lines.push('');
  return lines.join('\r\n');
}

/** Render a text as an RGBA image the way a camera frame would show it: scale 4, 4-module quiet zone, black on white. */
function renderQr(text, { scale = 4, margin = 4 } = {}) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'L' });
  const size = qr.modules.size;
  const width = (size + margin * 2) * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qr.modules.get(row, col)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((row + margin) * scale + dy) * width + (col + margin) * scale + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width, version: qr.version };
}

const decodeQr = (text) => {
  const { data, width, version } = renderQr(text);
  const found = jsQR(data, width, width);
  return { text: found?.data, version };
};

// ------------------------------------------------------------------ extractCode

const TOKEN = 'OXY1.' + 'AbC-_9xyz'.repeat(30);

describe('extractCode', () => {
  it('accepts a bare token', () => {
    expect(extractCode(TOKEN)).toBe(TOKEN);
  });

  it('accepts a join link carrying the token and returns the link', () => {
    const link = `https://example.com/oxy/join?c=${TOKEN}`;
    expect(extractCode(link)).toBe(link);
    expect(extractCode(`http://192.168.1.5:5173/join?x=1&c=${TOKEN}`)).toBe(`http://192.168.1.5:5173/join?x=1&c=${TOKEN}`);
    expect(extractCode(`https://example.com/#/join?c=${TOKEN}`)).toBe(`https://example.com/#/join?c=${TOKEN}`);
  });

  it('accepts OXY2 tokens (base32, current) as well as OXY1 (legacy)', () => {
    expect(extractCode('OXY2.ABCDEF234567')).toBe('OXY2.ABCDEF234567');
    expect(extractCode('https://example.com/join?c=OXY2.ABCDEF234567')).toBe('https://example.com/join?c=OXY2.ABCDEF234567');
  });

  it('trims surrounding whitespace and newlines', () => {
    expect(extractCode(`  ${TOKEN}\n`)).toBe(TOKEN);
    expect(extractCode(`\r\n\t https://example.com/join?c=${TOKEN} \n`)).toBe(`https://example.com/join?c=${TOKEN}`);
  });

  it('rejects junk', () => {
    for (const junk of ['', '   ', 'hello world', 'https://example.com', 'https://example.com/join', 'WIFI:S:home;T:WPA;P:secret;;', '12345', 'OXY1']) {
      expect(extractCode(junk)).toBeNull();
    }
    expect(extractCode(null)).toBeNull();
    expect(extractCode(undefined)).toBeNull();
    expect(extractCode(42)).toBeNull();
    expect(extractCode({})).toBeNull();
  });

  it('rejects near misses', () => {
    expect(extractCode('OXY1.')).toBeNull(); // prefix only
    expect(extractCode('oxy1.abcdef')).toBeNull(); // wrong case
    expect(extractCode('OXY3.abcdef')).toBeNull(); // other version
    expect(extractCode(' OXY1.abc def')).toBeNull(); // whitespace inside
    expect(extractCode('OXY1.abc+def/ghi=')).toBeNull(); // not base64url
    expect(extractCode('OXY1.abc\nOXY1.def')).toBeNull(); // two codes
    expect(extractCode(`see OXY1.abcdef`)).toBeNull(); // text before the token
    expect(extractCode(`https://example.com/join?c=OXY3.abcdef`)).toBeNull();
    expect(extractCode(`https://example.com/join?c=`)).toBeNull();
    expect(extractCode(`https://example.com/join?c=oxy1.abcdef`)).toBeNull();
    expect(extractCode(`https://example.com/join?xc=${TOKEN}`)).toBeNull(); // parameter is not exactly c
    expect(extractCode(`https://example.com/join?c=${TOKEN} and more`)).toBeNull();
    expect(extractCode(`ftp://example.com/join?c=${TOKEN}`)).toBeNull();
    expect(extractCode(`javascript:alert(1)//?c=${TOKEN}`)).toBeNull();
  });
});

// ------------------------------------------------------------------ QR round trip

describe('QR round trip with a real invite', () => {
  it('uses an SDP of realistic size (about 1.2 KB)', () => {
    const sdp = realisticSdp('offer');
    expect(sdp.length).toBeGreaterThan(1000);
    expect(sdp.length).toBeLessThan(1800);
  });

  for (const role of ['offer', 'answer']) {
    it(`decodes the raw ${role} token from its QR code`, async () => {
      const signal = { t: role, sdp: realisticSdp(role), room: 'abc123xy', seat: 2 };
      const token = await encodeSignal(signal);
      expect(token.startsWith(SIGNAL_PREFIX_V2)).toBe(true); // base32: QR alphanumeric mode, smaller code
      const { text, version } = decodeQr(token);
      console.log(`${role}: sdp ${signal.sdp.length} chars -> token ${token.length} chars, QR version ${version}`);
      expect(version).toBeLessThan(21); // the realistic token used to need V21 with base64url
      expect(text).toBe(token);
      expect(extractCode(text)).toBe(token);
      expect(await decodeSignal(text)).toEqual(signal); // and the scanned text still decodes to the original signal
    });
  }

  it('decodes the invite link from its QR code', async () => {
    const signal = { t: 'offer', sdp: realisticSdp('offer'), room: 'abc123xy', seat: 3 };
    const token = await encodeSignal(signal);
    const link = `https://oxy.example.com/join?c=${token}`;
    const { text } = decodeQr(link);
    expect(text).toBe(link);
    expect(extractCode(text)).toBe(link);
    expect(await decodeSignal(text)).toEqual(signal);
  });

  it('reports how large a payload survives the round trip', () => {
    // Version 40-L holds 2953 bytes. Try growing base64url texts until the first failure.
    const next = rng(99);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const body = Array.from({ length: 4000 }, () => alphabet[Math.floor(next() * 64)]).join('');
    let longest = 0;
    for (const length of [800, 1200, 1500, 2000, 2500, 2900, 2953]) {
      const text = 'OXY1.' + body.slice(0, length - 5);
      const { text: decoded } = decodeQr(text);
      expect(decoded).toBe(text);
      longest = length;
    }
    expect(longest).toBe(2953);
    console.log(`longest round-tripped QR text: ${longest} chars`);
  });
});
