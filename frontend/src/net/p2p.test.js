import { describe, it, expect, vi } from 'vitest';
import { createFraming, CHUNK_SIZE } from './framing.js';
import { encodeSignal, decodeSignal, validateSdp, SIGNAL_PREFIX, SIGNAL_PREFIX_V2 } from './signal.js';
import { createLocalBackend } from './localBackend.js';
import { createHostSession } from './hostSession.js';
import { acceptInvite, sanitizeResult } from './guestSession.js';
import { FakeHostPeer, FakeGuestPeer } from './fakePeer.js';

const tick = (ms = 15) => new Promise((resolve) => setTimeout(resolve, ms));

const SDP = (extra = []) =>
  [
    'v=0',
    'o=- 123 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    'a=ice-ufrag:abcd',
    'a=mid:0',
    ...extra,
    '',
  ].join('\r\n');

// ------------------------------------------------------------------ framing

describe('framing', () => {
  const loop = (maxBytes = 1_000_000) => {
    const received = [];
    const violations = [];
    const framing = createFraming({
      send: (frame) => framing.receive(frame),
      onMessage: (text) => received.push(text),
      onViolation: (reason) => violations.push(reason),
      maxBytes,
    });
    return { framing, received, violations };
  };

  it('round-trips a small message in one frame', () => {
    const { framing, received } = loop();
    framing.sendText('{"a":1}');
    expect(received).toEqual(['{"a":1}']);
  });

  it('splits a large message into several frames and reassembles it exactly', () => {
    const frames = [];
    const received = [];
    const framing = createFraming({ send: (f) => frames.push(f), onMessage: (t) => received.push(t), maxBytes: 1_000_000 });
    const text = 'x'.repeat(CHUNK_SIZE * 3 + 5);
    framing.sendText(text);
    expect(frames).toHaveLength(4);
    frames.reverse().forEach((f) => framing.receive(f)); // arrival order must not matter
    expect(received).toEqual([text]);
  });

  it('rejects malformed frames, non-strings and oversized frames', () => {
    const { framing, received, violations } = loop();
    framing.receive('hello');
    framing.receive('1.0:abc');
    framing.receive(42);
    framing.receive('1.0.1:' + 'x'.repeat(CHUNK_SIZE + 100));
    expect(received).toEqual([]);
    expect(violations).toEqual(['malformed frame', 'malformed frame', 'frame too large', 'frame too large']);
  });

  it('rejects impossible frame numbering', () => {
    const { framing, violations } = loop(50_000);
    framing.receive('1.5.2:abc'); // index beyond total
    framing.receive('1.0.0:abc'); // zero total
    framing.receive('1.0.9999:abc'); // far more frames than maxBytes could need
    expect(violations).toEqual(['bad frame numbering', 'bad frame numbering', 'bad frame numbering']);
  });

  it('drops a message whose frames disagree about the total', () => {
    const { framing, received, violations } = loop();
    framing.receive('7.0.2:abc');
    framing.receive('7.1.3:def');
    expect(received).toEqual([]);
    expect(violations).toEqual(['inconsistent frame count']);
  });

  it('enforces the maximum message size while reassembling', () => {
    const { framing, received, violations } = loop(CHUNK_SIZE + 10);
    framing.receive('1.0.2:' + 'x'.repeat(CHUNK_SIZE));
    framing.receive('1.1.2:' + 'y'.repeat(100));
    expect(received).toEqual([]);
    expect(violations).toEqual(['message too large']);
  });

  it('keeps at most two half-received messages (oldest is dropped)', () => {
    const { framing, received } = loop();
    framing.receive('1.0.2:aa');
    framing.receive('2.0.2:bb');
    framing.receive('3.0.2:cc'); // a third half-message evicts the oldest (1)
    framing.receive('2.1.2:BB'); // message 2 is still buffered and completes
    expect(received).toEqual(['bbBB']);
    framing.receive('1.1.2:AA'); // message 1 was evicted: this starts a fresh, incomplete entry
    expect(received).toEqual(['bbBB']);
  });
});

// ------------------------------------------------------------------ signalling blobs

describe('signal codec', () => {
  const offer = () => ({ t: 'offer', sdp: SDP(), room: 'abc123xy', seat: 2 });

  it('round-trips an offer and an answer', async () => {
    const text = await encodeSignal(offer());
    expect(text.startsWith(SIGNAL_PREFIX_V2)).toBe(true); // base32: smaller QR than legacy base64url
    expect(await decodeSignal(text)).toEqual(offer());
    const answer = { ...offer(), t: 'answer', seat: 3 };
    expect(await decodeSignal(await encodeSignal(answer))).toEqual(answer);
  });

  it('still decodes legacy OXY1 (base64url) invites', async () => {
    const json = JSON.stringify({ v: 1, ...offer() });
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    writer.write(new TextEncoder().encode(json));
    writer.close();
    const bytes = new Uint8Array(await new Response(stream.readable).arrayBuffer());
    const legacy =
      SIGNAL_PREFIX + btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    expect(await decodeSignal(legacy)).toEqual(offer());
    expect(await decodeSignal(`https://example.org/app/#/join?c=${legacy}`)).toEqual(offer());
  });

  it('accepts the token inside a link and tolerates surrounding whitespace', async () => {
    const text = await encodeSignal(offer());
    expect(await decodeSignal(`  https://example.org/app/#/join?c=${text}  `)).toEqual(offer());
    expect(await decodeSignal(`\n${text}\n`)).toEqual(offer());
  });

  it('rejects text that is not an invite', async () => {
    for (const bad of ['', 'hello', 'OXY2.abc', null, undefined, 42, {}]) {
      await expect(decodeSignal(bad)).rejects.toThrow();
    }
  });

  it('rejects invalid base64, garbage after the prefix, and oversized tokens', async () => {
    await expect(decodeSignal(SIGNAL_PREFIX + '***')).rejects.toThrow(/invalid characters/);
    await expect(decodeSignal(SIGNAL_PREFIX + 'AAAA')).rejects.toThrow(/damaged|invalid/i);
    await expect(decodeSignal(SIGNAL_PREFIX + 'A'.repeat(9000))).rejects.toThrow(/too large/);
  });

  it('survives a decompression bomb without buffering it', async () => {
    const bomb = new Uint8Array(5 * 1024 * 1024); // 5 MB of zeros compresses to ~5 KB (under the token limit)
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    writer.write(bomb);
    writer.close();
    const chunks = [];
    const reader = stream.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let offset = 0;
    for (const c of chunks) (bytes.set(c, offset), (offset += c.length));
    const b64 = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    expect(b64.length).toBeLessThan(8000);
    await expect(decodeSignal(SIGNAL_PREFIX + b64)).rejects.toThrow(/too large/);
  });

  it('rejects wrong version, type, room and seat', async () => {
    const make = async (patch) => {
      const json = JSON.stringify({ v: 1, ...offer(), ...patch });
      const stream = new CompressionStream('deflate-raw');
      const writer = stream.writable.getWriter();
      writer.write(new TextEncoder().encode(json));
      writer.close();
      const bytes = new Uint8Array(await new Response(stream.readable).arrayBuffer());
      return SIGNAL_PREFIX + btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    };
    await expect(decodeSignal(await make({ v: 2 }))).rejects.toThrow(/version/);
    await expect(decodeSignal(await make({ t: 'hack' }))).rejects.toThrow(/type/);
    await expect(decodeSignal(await make({ room: 'BAD ROOM!' }))).rejects.toThrow(/game id/);
    await expect(decodeSignal(await make({ seat: 1 }))).rejects.toThrow(/seat/);
    await expect(decodeSignal(await make({ seat: 5 }))).rejects.toThrow(/seat/);
    await expect(decodeSignal(await make({ seat: '2' }))).rejects.toThrow(/seat/);
    await expect(decodeSignal(await make({}))).resolves.toMatchObject({ t: 'offer', seat: 2 });
  });
});

describe('validateSdp', () => {
  it('accepts a plain data-channel description, including candidates', () => {
    const sdp = SDP([
      'a=candidate:842163049 1 udp 1677729535 192.168.1.20 46154 typ srflx raddr 0.0.0.0 rport 0 generation 0',
      'a=candidate:1 1 udp 2113937151 7b9f1c2e-aaaa-4bbb-8ccc-0123456789ab.local 54321 typ host generation 0',
      'a=end-of-candidates',
    ]);
    expect(validateSdp(sdp)).toBe(sdp);
  });

  it('rejects audio/video media, a second media section and non-datachannel media', () => {
    expect(() => validateSdp(SDP(['m=audio 9 UDP/TLS/RTP/SAVPF 111']))).toThrow();
    expect(() => validateSdp(SDP(['m=application 9 UDP/DTLS/SCTP webrtc-datachannel']))).toThrow(/Only a game data channel|data-channel/);
    expect(() => validateSdp(SDP().replace('webrtc-datachannel', 'DTLS/SCTP 5000'))).toThrow();
  });

  it('rejects wrong sizes, unreadable characters and unexpected line types', () => {
    expect(() => validateSdp('')).toThrow();
    expect(() => validateSdp(null)).toThrow();
    expect(() => validateSdp('v=0\r\n' + 'a=x\r\n'.repeat(2000))).toThrow();
    expect(() => validateSdp(SDP(['a=' + 'x'.repeat(400)]))).toThrow(/unreadable/);
    expect(() => validateSdp(SDP(['a=café']))).toThrow(/unreadable/);
    expect(() => validateSdp(SDP(['a=bell\u0007']))).toThrow(/unreadable/);
    expect(() => validateSdp(SDP(['k=clear:secret']))).toThrow(/unexpected line/);
    expect(() => validateSdp(SDP(['<script>alert(1)</script>']))).toThrow(/unexpected line/);
  });

  it('rejects malformed candidates (injection through the address field)', () => {
    expect(() => validateSdp(SDP(['a=candidate:1 1 udp 1 1.2.3.4 99 typ host; rm -rf /']))).toThrow(/candidate/);
    expect(() => validateSdp(SDP(['a=candidate:1 1 udp 1 <img src=x> 99 typ host']))).toThrow(/candidate/);
    expect(() => validateSdp(SDP(['a=candidate:1 1 udp 1 1.2.3.4 99 typ evil']))).toThrow(/candidate/);
  });

  it('requires v=0 first', () => {
    expect(() => validateSdp(SDP().replace('v=0', 'v=1'))).toThrow();
  });
});

// ------------------------------------------------------------------ sessions over a fake channel

async function pair({ playerCount = 2, hostOptions = {} } = {}) {
  const csw = 'CAT\nAT\nTO\nDOG\nCOT\n';
  const backend = createLocalBackend({ loadList: async (id) => (id === 'csw21' ? csw : null), persist: false });
  await backend.ready;
  await backend.dispatch({ type: 'restart', playerCount });
  const hostPeers = [];
  const host = createHostSession(backend, {
    createPeer: () => {
      const peer = new FakeHostPeer();
      hostPeers.push(peer);
      return peer;
    },
    ...hostOptions,
  });
  const guests = [];
  for (let seat = 2; seat <= playerCount; seat++) {
    const invite = await host.invite(seat);
    const guestPeers = [];
    const { answer, session } = await acceptInvite(invite, {
      createPeer: () => {
        const peer = new FakeGuestPeer();
        guestPeers.push(peer);
        return peer;
      },
    });
    await host.acceptAnswer(answer);
    await tick();
    guests.push({ seat, session, peer: guestPeers[0], hostPeer: hostPeers[hostPeers.length - 1] });
  }
  return { backend, host, guests, hostPeers };
}

const frame = (obj, id = Math.floor(Math.random() * 1e6)) => `${id}.0.1:${JSON.stringify(obj)}`;

let injectId = 5_000_000;
/** Deliver a (possibly large) JSON message the way a real peer would: split into frames. */
const injectJson = (peer, obj) => {
  const text = JSON.stringify(obj);
  const total = Math.max(1, Math.ceil(text.length / CHUNK_SIZE));
  const id = injectId++;
  for (let i = 0; i < total; i++) peer.inject(`${id}.${i}.${total}:${text.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)}`);
};

describe('pairing and play', () => {
  it('pairs, shows the guest the game state and keeps both sides in sync', async () => {
    const { backend, host, guests } = await pair();
    const [{ session }] = guests;
    expect(session.status).toBe('open');
    expect(host.snapshot().seats).toEqual({ 2: 'open' });

    const state = await session.backend.getState();
    expect(state.playerCount).toBe(2);
    expect(state.player2.rack).toHaveLength(7);

    await backend.dispatch({ type: 'pass', playerId: 1 });
    await tick();
    expect((await session.backend.getState()).currentPlayer).toBe(2);
  });

  it('a guest is pinned to their own seat and cannot act out of turn', async () => {
    const { guests } = await pair();
    const [{ session }] = guests;
    expect(await session.backend.dispatch({ type: 'pass', playerId: 1 })).toMatchObject({ success: false, error: 'That is not your seat' });
    expect(await session.backend.dispatch({ type: 'pass', playerId: 2 })).toMatchObject({ success: false, error: 'Not your turn' });
    // recall by the waiting player must not touch the host's tiles
    expect(await session.backend.dispatch({ type: 'recall', playerId: 2 })).toMatchObject({ success: false, error: 'Not your turn' });
  });

  it('applies a valid guest action on the host and returns fresh state with the result', async () => {
    const { backend, guests } = await pair();
    const [{ session }] = guests;
    await backend.dispatch({ type: 'pass', playerId: 1 });
    await tick();
    const result = await session.backend.dispatch({ type: 'pass', playerId: 2 });
    expect(result.success).toBe(true);
    // two passes in a row end a two-player game
    expect(result.gameState.gameOver).toBe(true);
    expect(backend.engine.getState().gameOver).toBe(true);
  });

  it('a guest can play a real word over the channel and the host sees it', async () => {
    const { backend, guests } = await pair();
    const [{ session }] = guests;
    await backend.dispatch({ type: 'pass', playerId: 1 });
    await tick();
    backend.engine.debugSetRack(2, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    await session.backend.getState();
    await backend.dispatch({ type: 'validate-word', word: 'cat' }); // host dictionary has it
    // the guest's own view of its rack is stale (set behind its back): refresh via a host state push
    await backend.dispatch({ type: 'update-viewport', viewportCenter: { row: 7, col: 7 } });
    await tick();
    for (const [i, col] of [6, 7, 8].entries()) {
      const placed = await session.backend.dispatch({ type: 'place-tile', playerId: 2, rackIndex: 0, row: 7, col });
      expect(placed.success, `tile ${i}`).toBe(true);
    }
    const played = await session.backend.dispatch({ type: 'play-word', playerId: 2 });
    expect(played).toMatchObject({ success: true, score: 10 }); // C3 + A1 + T1 = 5, doubled on the centre star
    expect(backend.engine.getState().player2.score).toBe(10);
    expect(played.gameState.player2.score).toBe(10);
  });

  it('supports several guests, each pinned to its own seat', async () => {
    const { host, guests } = await pair({ playerCount: 3 });
    expect(host.snapshot().seats).toEqual({ 2: 'open', 3: 'open' });
    const [g2, g3] = guests;
    expect(await g3.session.backend.dispatch({ type: 'pass', playerId: 2 })).toMatchObject({ error: 'That is not your seat' });
    expect(await g2.session.backend.dispatch({ type: 'pass', playerId: 3 })).toMatchObject({ error: 'That is not your seat' });
  });

  it('rejects an invite for a seat that is not in the game', async () => {
    const { host } = await pair({ playerCount: 2 });
    await expect(host.invite(3)).rejects.toThrow(/not in this game/);
    await expect(host.invite(1)).rejects.toThrow();
    await expect(host.invite('2')).rejects.toThrow();
  });

  it('rejects an answer for another game, for the wrong direction, or for a seat nobody invited', async () => {
    const { host } = await pair();
    const other = await pair();
    const inviteOther = await other.host.invite(2);
    const guestAnswerOther = (await acceptInvite(inviteOther, { createPeer: () => new FakeGuestPeer() })).answer;
    await expect(host.acceptAnswer(guestAnswerOther)).rejects.toThrow(/different game/);
    await expect(host.acceptAnswer(inviteOther)).rejects.toThrow(/invite, not an answer/);
    await expect(host.acceptAnswer('nonsense')).rejects.toThrow();
  });

  it('a guest cannot accept an answer as an invite', async () => {
    const { host } = await pair();
    const invite = await host.invite(2);
    const { answer } = await acceptInvite(invite, { createPeer: () => new FakeGuestPeer() });
    await expect(acceptInvite(answer, { createPeer: () => new FakeGuestPeer() })).rejects.toThrow(/answer, not an invite/);
  });

  it('marks a seat closed when the connection drops, and allows re-inviting it', async () => {
    const { host, guests } = await pair();
    const [{ session, hostPeer }] = guests;
    hostPeer.close();
    await tick();
    expect(host.snapshot().seats).toEqual({ 2: 'closed' });
    expect(session.status).toBe('closed');
    expect(await session.backend.dispatch({ type: 'pass', playerId: 2 })).toMatchObject({ success: false, error: /lost/ });
    const invite = await host.invite(2);
    expect(invite.startsWith(SIGNAL_PREFIX_V2)).toBe(true);
  });

  it('a twice-scanned answer fails friendly and still connects (no raw stable-state error)', async () => {
    const csw = 'CAT\nAT\nTO\nDOG\nCOT\n';
    const backend = createLocalBackend({ loadList: async (id) => (id === 'csw21' ? csw : null), persist: false });
    await backend.ready;
    await backend.dispatch({ type: 'restart', playerCount: 2 });
    const host = createHostSession(backend, { createPeer: () => new FakeHostPeer() });
    const invite = await host.invite(2);
    const { answer } = await acceptInvite(invite, { createPeer: () => new FakeGuestPeer() });
    await host.acceptAnswer(answer); // the scan applies it
    const second = await host.acceptAnswer(answer).then(
      () => null,
      (error) => error,
    ); // the follow-up tap must not hit WebRTC again
    expect(second).toBeInstanceOf(Error);
    expect(second.message).not.toMatch(/wrong state|stable|InvalidState/);
    await tick();
    expect(host.snapshot().seats).toEqual({ 2: 'open' });
  });

  it('concurrent double answers never surface a raw WebRTC state error', async () => {
    const csw = 'CAT\nAT\nTO\nDOG\nCOT\n';
    const backend = createLocalBackend({ loadList: async (id) => (id === 'csw21' ? csw : null), persist: false });
    await backend.ready;
    await backend.dispatch({ type: 'restart', playerCount: 2 });
    const host = createHostSession(backend, { createPeer: () => new FakeHostPeer() });
    const invite = await host.invite(2);
    const { answer } = await acceptInvite(invite, { createPeer: () => new FakeGuestPeer() });
    const results = await Promise.allSettled([host.acceptAnswer(answer), host.acceptAnswer(answer)]);
    for (const result of results) {
      if (result.status === 'rejected') expect(result.reason.message).not.toMatch(/wrong state|stable|InvalidState/);
    }
    await tick();
    expect(host.snapshot().seats).toEqual({ 2: 'open' });
  });

  it('a stale answer after re-inviting leaves the seat waiting, and the fresh answer works', async () => {
    const csw = 'CAT\nAT\nTO\nDOG\nCOT\n';
    const backend = createLocalBackend({ loadList: async (id) => (id === 'csw21' ? csw : null), persist: false });
    await backend.ready;
    await backend.dispatch({ type: 'restart', playerCount: 2 });
    const host = createHostSession(backend, { createPeer: () => new FakeHostPeer() });
    const invite1 = await host.invite(2);
    const { answer: answer1 } = await acceptInvite(invite1, { createPeer: () => new FakeGuestPeer() });
    const invite2 = await host.invite(2); // host starts over: new offer, old answer is stale
    const { answer: answer2 } = await acceptInvite(invite2, { createPeer: () => new FakeGuestPeer() });
    await expect(host.acceptAnswer(answer1)).rejects.toThrow(/match the current invite/);
    expect(host.snapshot().seats[2]).toBe('waiting');
    await host.acceptAnswer(answer2);
    await tick();
    expect(host.snapshot().seats).toEqual({ 2: 'open' });
  });
});

describe('a hostile guest', () => {
  it('is disconnected after repeated unreadable or unknown messages', async () => {
    const { host, guests } = await pair();
    const { hostPeer } = guests[0];
    for (let i = 1; i <= 5; i++) hostPeer.inject(`${i}.0.1:{not json`); // well-framed but unreadable
    await tick();
    expect(host.snapshot().seats[2]).toBe('closed');
  });

  it('cannot smuggle prototype pollution through an action', async () => {
    const { guests } = await pair();
    const { hostPeer } = guests[0];
    hostPeer.inject(`1.0.1:{"t":"action","id":1,"action":{"type":"validate-word","word":"ab","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}}`);
    await tick();
    expect({}.polluted).toBeUndefined();
  });

  it('gets no result for an out-of-range id and an action over the size limit is refused', async () => {
    const { host, guests } = await pair();
    const { session, hostPeer } = guests[0];
    hostPeer.inject(frame({ t: 'action', id: -4, action: { type: 'pass', playerId: 2 } }));
    hostPeer.inject(frame({ t: 'action', id: 1.5, action: { type: 'pass', playerId: 2 } }));
    await tick();
    expect(host.snapshot().seats[2]).toBe('open'); // two violations are tolerated
    const big = await session.backend.dispatch({ type: 'validate-word', word: 'cat', pad: 'x'.repeat(9000) });
    expect(big).toMatchObject({ success: false, error: 'Action too large' });
  });

  it('is rate limited: a flood is cut off', async () => {
    let clock = 0;
    const { host, guests } = await pair({ hostOptions: { now: () => clock } });
    const { hostPeer } = guests[0];
    for (let i = 0; i < 200; i++) hostPeer.inject(frame({ t: 'ping' }, i + 1));
    await tick();
    expect(host.snapshot().seats[2]).toBe('closed');
    clock += 10_000;
  });

  it('may send a normal burst of pings without being dropped', async () => {
    const { host, guests } = await pair();
    const { hostPeer } = guests[0];
    for (let i = 0; i < 30; i++) hostPeer.inject(frame({ t: 'ping' }, i + 1));
    await tick();
    expect(host.snapshot().seats[2]).toBe('open');
  });

  it('cannot act through a closed seat', async () => {
    const { backend, host, guests } = await pair();
    const { hostPeer } = guests[0];
    for (let i = 0; i < 6; i++) hostPeer.inject('garbage');
    await tick();
    expect(host.snapshot().seats[2]).toBe('closed');
    const before = JSON.stringify(backend.engine.getState());
    hostPeer.inject(frame({ t: 'action', id: 1, action: { type: 'pass', playerId: 2 } }));
    await tick();
    expect(JSON.stringify(backend.engine.getState())).toBe(before);
  });
});

describe('a hostile host', () => {
  const hostile = async () => {
    const { guests } = await pair();
    return guests[0];
  };

  it('a valid state is accepted, but one with a malformed board is rejected and the previous state is kept', async () => {
    const { session, peer } = await hostile();
    const good = JSON.parse(JSON.stringify(await session.backend.getState()));
    injectJson(peer, { t: 'state', state: { ...good, message: 'accepted' } });
    await tick();
    expect((await session.backend.getState()).message).toBe('accepted'); // proves large states do get through

    injectJson(peer, { t: 'state', state: { ...good, message: 'REJECTED', board: good.board.slice(0, 14) } });
    await tick();
    const after = await session.backend.getState();
    expect(after.message).toBe('accepted');
    expect(after.board).toHaveLength(15);
  });

  it('state is rebuilt from a whitelist: extra fields, huge strings and control characters do not survive', async () => {
    const { session, peer } = await hostile();
    const good = JSON.parse(JSON.stringify(await session.backend.getState()));
    const evil = {
      ...good,
      message: `hi\u2028\u0000${'A'.repeat(1000)}`,
      pwned: '<script>alert(1)</script>',
      player1: { ...good.player1, extra: 1, playerName: '<img src=x onerror=alert(1)>' + 'N'.repeat(100) },
    };
    injectJson(peer, { t: 'state', state: evil });
    await tick();
    const state = await session.backend.getState();
    expect(state.message).toBe('hi' + 'A'.repeat(298)); // control characters stripped, capped at 300
    expect(state.pwned).toBeUndefined();
    expect(state.player1.extra).toBeUndefined();
    expect(state.player1.playerName).toHaveLength(30);
  });

  it('is dropped after repeated garbage', async () => {
    const { session, peer } = await hostile();
    for (let i = 0; i < 5; i++) peer.inject(frame({ t: 'state', state: 'nope' }, i + 1));
    await tick();
    expect(session.status).toBe('closed');
  });

  it('a hello for another seat is refused', async () => {
    const { session, peer } = await hostile();
    const good = await session.backend.getState();
    peer.inject(frame({ t: 'hello', seat: 3, state: good }));
    await tick();
    expect(session.status).toBe('open'); // still the original connection; the bogus hello changed nothing
  });

  it('ignores results nobody asked for', async () => {
    const { session, peer } = await hostile();
    peer.inject(frame({ t: 'result', id: 999, result: { success: true } }));
    await tick();
    expect(session.status).toBe('open');
  });

  it('sanitizeResult keeps only known fields with sane values', () => {
    expect(sanitizeResult(null)).toEqual({ success: false, error: 'Bad reply from host' });
    expect(
      sanitizeResult({
        success: true,
        score: 12,
        extra: '<b>x</b>',
        error: 'e'.repeat(500),
        unassignedBlanks: [{ row: 1, col: 2 }, { row: 99, col: 0 }, 'x'],
        __proto__: { polluted: 1 },
      })
    ).toEqual({ success: true, score: 12, error: 'e'.repeat(200), unassignedBlanks: [{ row: 1, col: 2 }] });
    expect(sanitizeResult({ success: 'yes' }).success).toBe(false);
  });
});

describe('host options', () => {
  it('times out when the host does not answer', async () => {
    vi.useFakeTimers();
    try {
      const { guests } = await (async () => {
        vi.useRealTimers();
        const made = await pair();
        vi.useFakeTimers();
        return made;
      })();
      const { session, hostPeer } = guests[0];
      hostPeer.send = () => {}; // the host's replies vanish
      const pending = session.backend.dispatch({ type: 'validate-word', word: 'cat' });
      await vi.advanceTimersByTimeAsync(9000);
      expect(await pending).toMatchObject({ success: false, error: 'The host did not answer in time' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('word lists that are really an HTML fallback page', () => {
  it('looksLikeHtml recognises a host answering a missing file with its index page', async () => {
    const { looksLikeHtml } = await import('./localBackend.js');
    expect(looksLikeHtml('<!doctype html>\n<html lang="en"><head>')).toBe(true);
    expect(looksLikeHtml('  \n<!DOCTYPE HTML><html>')).toBe(true);
    expect(looksLikeHtml('<html><body>Not found</body></html>')).toBe(true);
    expect(looksLikeHtml('aa\naah\naahed\n')).toBe(false);
    expect(looksLikeHtml('cat a small animal\ndog another\n')).toBe(false);
  });

  it('the backend treats such a response as "not installed" and falls back to a list that really exists', async () => {
    const html = '<!doctype html><html><head><title>app</title></head><body></body></html>';
    const backend = createLocalBackend({
      loadList: async (id) => (id === 'csw21' ? html : id === 'enable' ? 'cat\nat\n' : null),
      listIds: async () => ['csw21', 'enable'], // both are "shipped"; csw21's file is really the host's fallback page
      persist: false,
    });
    await backend.ready;
    expect(backend.missingLists()).toEqual(['csw21']);
    const state = await backend.getState();
    expect(state.dictionaries).toEqual({ csw21: false, nwl2023: false, enable: true, friendly: false, slovenian: false });
    expect(state.message).toBe('The chosen word list is not installed; using ENABLE instead.');
    expect((await backend.dispatch({ type: 'validate-word', word: 'cat' })).valid).toBe(true);
    expect((await backend.dispatch({ type: 'validate-word', word: 'html' })).valid).toBe(false); // the page's text did not become words
  });

  it('with no usable list at all it says so instead of silently accepting nothing', async () => {
    const backend = createLocalBackend({ loadList: async () => '<html></html>', listIds: async () => ['csw21'], persist: false });
    await backend.ready;
    const state = await backend.getState();
    expect(state.messageType).toBe('error');
    expect(state.message).toMatch(/No word list is installed/);
  });
});
