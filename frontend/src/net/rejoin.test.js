import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLocalBackend } from './localBackend.js';
import { createHostSession } from './hostSession.js';
import { acceptInvite } from './guestSession.js';
import { net, initNet, joinWithInvite, leaveGame, lastGuestSeat } from './session.js';
import { FakeHostPeer, FakeGuestPeer } from './fakePeer.js';

const tick = (ms = 15) => new Promise((resolve) => setTimeout(resolve, ms));
// The hello round-trip is a few chained macrotasks; under parallel test load
// a fixed tick can be too short, so poll instead of sleeping once.
async function waitFor(fn, timeoutMs = 3000) {
  const start = Date.now();
  for (;;) {
    try {
      fn();
      return;
    } catch (error) {
      if (Date.now() - start > timeoutMs) throw error;
      await tick(10);
    }
  }
}
const SAVE_KEY = 'oxyphenbutazone_local_game_v1';
const CSW = 'CAT\nAT\nTO\nDOG\nCOT\n';

let storage;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  });
});
afterEach(() => {
  leaveGame();
  vi.unstubAllGlobals();
});

const backendWith = (options = {}) =>
  createLocalBackend({
    loadList: async (id) => (id === 'csw21' ? CSW : null),
    listIds: async () => ['csw21'],
    ...options,
  });

// ------------------------------------------------------------------ host reload mid-turn

describe('host reload mid-turn loses nothing', () => {
  it('uncommitted placed tiles, racks and turn survive a reload', async () => {
    const first = backendWith({ persist: true });
    await first.ready;
    await first.dispatch({ type: 'restart', playerCount: 2, language: 'english' });
    first.engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    // A viewport push persists the new racks, like the real UI does after dealing
    await first.dispatch({ type: 'update-viewport', viewportCenter: { row: 7, col: 7 } });
    // Player 1 places a tile but does NOT play it yet: the turn is mid-air
    expect((await first.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 7 })).success).toBe(true);

    // The phone reboots: a brand-new backend reads the same storage
    const reloaded = backendWith({ persist: true });
    await reloaded.ready;
    const state = await reloaded.getState();
    expect(state.board[7][7].letter).toBe('c');
    expect(state.board[7][7].isNew).toBe(true);
    expect(state.currentPlayer).toBe(1);
    expect(state.player1.rack).toHaveLength(6);
    expect(state.player2.rack).toHaveLength(7);
  });

  it('a played word also survives, so the guest rejoins onto the same score', async () => {
    const first = backendWith({ persist: true });
    await first.ready;
    await first.dispatch({ type: 'restart', playerCount: 2, language: 'english' });
    first.engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    await first.dispatch({ type: 'update-viewport', viewportCenter: { row: 7, col: 7 } });
    for (const col of [6, 7, 8]) {
      expect((await first.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col })).success).toBe(true);
    }
    const played = await first.dispatch({ type: 'play-word', playerId: 1 });
    expect(played).toMatchObject({ success: true, score: 10 });

    const reloaded = backendWith({ persist: true });
    await reloaded.ready;
    const state = await reloaded.getState();
    expect(state.player1.score).toBe(10);
    expect(state.currentPlayer).toBe(2);
    expect(state.board[7][7].letter).toBe('a');
  });
});

describe('corrupt saved games fall back to a fresh game', () => {
  const bootsFresh = async () => {
    const backend = backendWith({ persist: true });
    await backend.ready;
    return backend.getState();
  };

  it('half-written JSON is ignored', async () => {
    storage.set(SAVE_KEY, '{"v":1,"state":{"board":');
    const state = await bootsFresh();
    expect(state.player1.score).toBe(0);
    expect(state.board).toHaveLength(15);
  });

  it('an unknown envelope version is ignored (never trusted)', async () => {
    const first = backendWith({ persist: true });
    await first.ready;
    await first.dispatch({ type: 'restart', playerCount: 2, language: 'english' });
    first.engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    await first.dispatch({ type: 'update-viewport', viewportCenter: { row: 7, col: 7 } });
    await first.dispatch({ type: 'pass', playerId: 1 });
    const saved = JSON.parse(storage.get(SAVE_KEY));
    saved.v = 999;
    storage.set(SAVE_KEY, JSON.stringify(saved));
    const state = await bootsFresh();
    expect(state.currentPlayer).toBe(1); // the pass did not survive: the save was discarded wholesale
    expect(state.board[7][7].letter).toBe('');
  });

  it('a hostile save (wrong shapes, prototype keys) is ignored and does not pollute', async () => {
    storage.set(SAVE_KEY, JSON.stringify({ v: 1, state: { board: 'x', __proto__: { polluted: true } } }));
    const state = await bootsFresh();
    expect(state.board).toHaveLength(15);
    expect({}.polluted).toBeUndefined();
  });

  it('a legacy bare-state save (from before envelopes) is still honoured', async () => {
    const first = backendWith({ persist: false });
    await first.ready;
    await first.dispatch({ type: 'restart', playerCount: 2, language: 'english' });
    const bare = await first.getState();
    storage.set(SAVE_KEY, JSON.stringify(bare));
    const state = await bootsFresh();
    expect(state.playerCount).toBe(2);
  });
});

// ------------------------------------------------------------------ guest rejoin after the host re-hosts

describe('guest rejoin after the host restarts', () => {
  async function playAndDrop() {
    const backend = backendWith({ persist: false });
    await backend.ready;
    await backend.dispatch({ type: 'restart', playerCount: 2, language: 'english' });
    const host = createHostSession(backend, { createPeer: () => new FakeHostPeer() });
    const invite = await host.invite(2);
    const joined = await acceptInvite(invite, { createPeer: () => new FakeGuestPeer() });
    await host.acceptAnswer(joined.answer);
    await tick();
    const guest = joined.session;

    // Host plays CAT for 10, guest plays TO for 3 (same shape as the p2p play test)
    backend.engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    backend.engine.debugSetRack(2, ['o', 'd', 'g', 'e', 'i', 'n', 'r']);
    await backend.dispatch({ type: 'update-viewport', viewportCenter: { row: 7, col: 7 } });
    await tick();
    for (const col of [6, 7, 8]) {
      expect((await backend.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col })).success).toBe(true);
    }
    expect(await backend.dispatch({ type: 'play-word', playerId: 1 })).toMatchObject({ success: true, score: 10 });
    await tick();
    expect((await guest.backend.dispatch({ type: 'place-tile', playerId: 2, rackIndex: 0, row: 8, col: 8 })).success).toBe(true);
    expect(await guest.backend.dispatch({ type: 'play-word', playerId: 2 })).toMatchObject({ success: true, score: 3 });

    // The host's phone reboots: the connection drops, the host re-hosts the same game (new room)
    host.close();
    await tick();
    expect(guest.status).toBe('closed');
    const rehost = createHostSession(backend, { createPeer: () => new FakeHostPeer() });
    expect(rehost.room).not.toBe(host.room);
    return { backend, stale: joined, rehost };
  }

  it('the old answer belongs to a dead room and says so', async () => {
    const { rehost, stale } = await playAndDrop();
    await expect(rehost.acceptAnswer(stale.answer)).rejects.toThrow(/different game/);
    expect(rehost.snapshot().seats).toEqual({});
  });

  it('a fresh handshake reconciles the guest onto the identical game (scores, board, turn)', async () => {
    const { backend, rehost } = await playAndDrop();
    const invite = await rehost.invite(2);
    const { answer, session } = await acceptInvite(invite, { createPeer: () => new FakeGuestPeer() });
    await rehost.acceptAnswer(answer);
    await waitFor(() => expect(session.status).toBe('open'));
    const state = await session.backend.getState();
    expect(state.player1.score).toBe(10);
    expect(state.player2.score).toBe(3);
    expect(state.currentPlayer).toBe(1);
    expect(state.board[7][7].letter).toBe('a');
    expect(rehost.snapshot().seats).toEqual({ 2: 'open' });
    expect(backend.engine.getState().player2.score).toBe(3);
  });
});

// ------------------------------------------------------------------ double rejoin

describe('double rejoin through session.js', () => {
  async function hosting() {
    const backend = backendWith({ persist: false });
    await backend.ready;
    await backend.dispatch({ type: 'restart', playerCount: 2, language: 'english' });
    initNet(backend);
    const host = createHostSession(backend, { createPeer: () => new FakeHostPeer() });
    return { backend, host, invite: await host.invite(2) };
  }

  it('two overlapping joins: the first is superseded, the second wins and owns net', async () => {
    const { host, invite } = await hosting();
    const first = joinWithInvite(invite, { createPeer: () => new FakeGuestPeer() });
    const second = joinWithInvite(invite, { createPeer: () => new FakeGuestPeer() });
    await expect(first).rejects.toThrow(/newer join/);
    const answer = await second;
    await host.acceptAnswer(answer);
    await waitFor(() => expect(net.guestStatus).toBe('open'));
    expect(net.role).toBe('guest');
    expect(net.seat).toBe(2);
    expect(lastGuestSeat()).toEqual({ seat: 2 });
  });

  it('the host pairs the answer it was given, not the last guest that registered', async () => {
    const backend = backendWith({ persist: false });
    await backend.ready;
    await backend.dispatch({ type: 'restart', playerCount: 2, language: 'english' });
    const host = createHostSession(backend, { createPeer: () => new FakeHostPeer() });
    const invite = await host.invite(2);
    // Two answers from one invite (a retried join); the second registration
    // must not steal the channel when the host applies the first answer.
    const g1 = await acceptInvite(invite, { createPeer: () => new FakeGuestPeer() });
    const g2 = await acceptInvite(invite, { createPeer: () => new FakeGuestPeer() });
    g2.session.close(); // the retried join is abandoned
    await host.acceptAnswer(g1.answer);
    await waitFor(() => expect(g1.session.status).toBe('open'));
    expect(host.snapshot().seats).toEqual({ 2: 'open' });
    expect(g2.session.status).toBe('closed');
  });

  it('leaving invalidates a join that is still gathering candidates', async () => {
    const { invite } = await hosting();
    const pending = joinWithInvite(invite, { createPeer: () => new FakeGuestPeer() });
    leaveGame();
    await expect(pending).rejects.toThrow(/newer join/);
    expect(net.role).toBe('none');
    expect(net.guestStatus).toBe('idle');
  });
});

// ------------------------------------------------------------------ clock skew

describe('lastGuestSeat hint storage', () => {
  it('corrupt or versioned-out entries read as null instead of throwing', async () => {
    expect(lastGuestSeat()).toBeNull();
    storage.set('oxyphenbutazone_last_guest_v1', '{broken');
    expect(lastGuestSeat()).toBeNull();
    storage.set('oxyphenbutazone_last_guest_v1', JSON.stringify({ v: 999, seat: 2 }));
    expect(lastGuestSeat()).toBeNull();
    storage.set('oxyphenbutazone_last_guest_v1', JSON.stringify({ v: 1, seat: 9 }));
    expect(lastGuestSeat()).toBeNull();
  });
});

describe('host rate limiting under clock skew', () => {
  it('a clock stepping backwards does not drain the bucket and drop a good guest', async () => {
    let clock = 10_000;
    const backend = backendWith({ persist: false });
    await backend.ready;
    await backend.dispatch({ type: 'restart', playerCount: 2, language: 'english' });
    const hostPeers = [];
    const host = createHostSession(backend, {
      createPeer: () => {
        const peer = new FakeHostPeer();
        hostPeers.push(peer);
        return peer;
      },
      now: () => clock,
    });
    const invite = await host.invite(2);
    const { answer } = await acceptInvite(invite, { createPeer: () => new FakeGuestPeer() });
    await host.acceptAnswer(answer);
    await tick();
    expect(host.snapshot().seats).toEqual({ 2: 'open' });

    const ping = (id) => hostPeers[0].inject(`${id}.0.1:{"t":"ping"}`);
    for (let i = 0; i < 10; i++) ping(i + 1);
    await tick();
    expect(host.snapshot().seats).toEqual({ 2: 'open' });

    clock = 0; // the phone's clock steps backwards (NTP, timezone, manual change)
    for (let i = 0; i < 10; i++) ping(100 + i);
    await tick();
    // Without the clamp the negative refill delta drains the bucket and these
    // 10 legitimate pings become 10 violations, disconnecting the guest.
    expect(host.snapshot().seats).toEqual({ 2: 'open' });

    clock = 30_000; // time moving forward again refills the bucket
    for (let i = 0; i < 10; i++) ping(200 + i);
    await tick();
    expect(host.snapshot().seats).toEqual({ 2: 'open' });
  });
});
