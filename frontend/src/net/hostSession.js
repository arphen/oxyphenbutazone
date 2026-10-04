// The phone (or laptop) that hosts a peer-to-peer game. It owns the game (a local backend running the shared engine),
// invites guests into seats 2-4 and applies their actions.
//
// Guests are untrusted: each message is size-capped, rate-limited and parsed with safeJsonParse; actions are
// validated by the engine (protocol.sanitizeAction) and PINNED to the guest's seat, so a guest can only ever act as
// themselves. A guest that keeps breaking the rules is disconnected.

import { createFraming } from './framing.js';
import { encodeSignal, decodeSignal } from './signal.js';
import { HostPeer } from './peer.js';
import { ProtocolError, safeJsonParse, MAX_ACTION_BYTES } from '../shared/protocol.js';
import { logWarn } from '../utils/log.js';

const MAX_HOST_MESSAGE = MAX_ACTION_BYTES + 512;
const RATE_CAPACITY = 40; // burst of messages
const RATE_PER_SECOND = 20;
const MAX_VIOLATIONS = 5;

const randomRoom = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join('');

/**
 * @param backend  a local backend (see localBackend.js)
 * @param options  { online, createPeer, now, onChange }
 */
export function createHostSession(backend, { online = false, createPeer = (opts) => new HostPeer(opts), now = Date.now, onChange = () => {} } = {}) {
  const room = randomRoom();
  const seats = new Map(); // seat -> record

  const snapshot = () => ({
    room,
    seats: Object.fromEntries([...seats].map(([seat, rec]) => [seat, rec.status])),
  });
  const emit = () => onChange(snapshot());

  const sendTo = (rec, message) => rec.framing.sendText(JSON.stringify(message));

  function drop(rec, reason) {
    logWarn(`[Host] Disconnecting seat ${rec.seat}: ${reason}`);
    rec.status = 'closed';
    rec.peer.close();
    emit();
  }

  function violation(rec, reason) {
    logWarn(`[Host] Seat ${rec.seat} violation: ${reason}`);
    if (++rec.violations >= MAX_VIOLATIONS) drop(rec, 'too many invalid messages');
  }

  function allowed(rec) {
    const t = now();
    // Clamp the refill delta at zero: a phone clock stepping backwards (NTP,
    // timezone, manual change) must not drain the bucket and drop a good guest.
    const dt = Math.max(0, t - rec.lastRefill);
    rec.tokens = Math.min(RATE_CAPACITY, rec.tokens + (dt / 1000) * RATE_PER_SECOND);
    rec.lastRefill = t;
    if (rec.tokens < 1) return false;
    rec.tokens -= 1;
    return true;
  }

  async function onGuestMessage(rec, text) {
    if (rec.status !== 'open') return;
    if (!allowed(rec)) return violation(rec, 'sending too fast');
    let message;
    try {
      message = safeJsonParse(text, MAX_HOST_MESSAGE);
    } catch {
      return violation(rec, 'unreadable message');
    }
    if (!message || typeof message !== 'object') return violation(rec, 'message is not an object');

    if (message.t === 'ping') return sendTo(rec, { t: 'pong' });
    if (message.t !== 'action' || !Number.isInteger(message.id) || message.id < 0 || message.id > 1e9) {
      return violation(rec, 'unknown message');
    }
    let result;
    try {
      result = await backend.dispatch(message.action, { playerId: rec.seat }); // seat-pinned
    } catch {
      result = { success: false, error: 'Action failed' };
    }
    // The new state was already broadcast (the backend notifies before returning), so the result need not carry it.
    const rest = { ...result };
    delete rest.gameState;
    sendTo(rec, { t: 'result', id: message.id, result: rest });
  }

  const stopListening = backend.onChange((state) => {
    for (const rec of seats.values()) if (rec.status === 'open') sendTo(rec, { t: 'state', state });
  });

  return {
    room,
    snapshot,

    /** Create an invite for a seat (2-4). Returns the text to show/send to that guest. */
    async invite(seat) {
      const state = await backend.getState();
      if (!Number.isInteger(seat) || seat < 2 || seat > state.playerCount) throw new ProtocolError('That seat is not in this game');
      seats.get(seat)?.peer.close();

      const peer = createPeer({ online });
      const rec = { seat, peer, status: 'inviting', violations: 0, tokens: RATE_CAPACITY, lastRefill: now() };
      rec.framing = createFraming({
        send: (frame) => peer.send(frame),
        maxBytes: MAX_HOST_MESSAGE,
        onMessage: (text) => onGuestMessage(rec, text),
        onViolation: (reason) => violation(rec, reason),
      });
      peer.onText = (frame) => rec.framing.receive(frame);
      peer.onOpen = async () => {
        if (seats.get(seat) !== rec) return;
        rec.status = 'open';
        sendTo(rec, { t: 'hello', seat, state: await backend.getState() });
        emit();
      };
      peer.onClose = () => {
        if (seats.get(seat) !== rec || rec.status === 'closed') return;
        rec.status = 'closed';
        emit();
      };
      seats.set(seat, rec);
      emit();

      const sdp = await peer.createOffer();
      rec.status = 'waiting';
      emit();
      return encodeSignal({ t: 'offer', sdp, room, seat });
    },

    /** Complete the pairing with the answer text the guest sent back. Resolves to the seat that is now connecting. */
    async acceptAnswer(text) {
      const answer = await decodeSignal(text);
      if (answer.t !== 'answer') throw new ProtocolError('That is an invite, not an answer');
      if (answer.room !== room) throw new ProtocolError('That answer belongs to a different game');
      const rec = seats.get(answer.seat);
      if (!rec || rec.status !== 'waiting') throw new ProtocolError('No invite is waiting for that seat');
      // The scan flow applies the answer automatically and leaves Connect
      // enabled, so a second tap (or double scan) can arrive while the first
      // is still being applied. Fail friendly instead of hitting WebRTC twice.
      if (rec.accepting) throw new ProtocolError('That answer is already being applied, still connecting');
      rec.accepting = true;
      rec.status = 'connecting';
      emit();
      try {
        await rec.peer.acceptAnswer(answer.sdp);
      } catch (error) {
        // A bad answer must not wedge the seat: back to waiting so the host
        // can scan or paste the right one.
        rec.accepting = false;
        rec.status = 'waiting';
        emit();
        if (error?.message === 'answer does not match this invite') {
          throw new ProtocolError('That answer does not match the current invite. Invite again or scan the latest answer.');
        }
        throw error;
      }
      rec.accepting = false;
      return answer.seat;
    },

    close() {
      stopListening();
      for (const rec of seats.values()) rec.peer.close();
      seats.clear();
      emit();
    },
  };
}
