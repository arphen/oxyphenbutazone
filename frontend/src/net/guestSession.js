// The joining phone. It shows whatever game state the host sends and forwards the player's actions to the host.
// The host is untrusted too (it could be compromised or spoofed): every state is rebuilt by sanitizeGameState before
// it can reach the UI, every result is reduced to a whitelist of fields, and a host that sends garbage is dropped.

import { createFraming } from './framing.js';
import { encodeSignal, decodeSignal } from './signal.js';
import { GuestPeer } from './peer.js';
import { ProtocolError, safeJsonParse, trySanitizeGameState, cleanString, MAX_ACTION_BYTES, MAX_STATE_BYTES } from '../shared/protocol.js';
import { logWarn } from '../utils/log.js';

const MAX_GUEST_MESSAGE = MAX_STATE_BYTES + 4096;
const MAX_BAD_MESSAGES = 4;
const REQUEST_TIMEOUT_MS = 8000;

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/** Reduce an action result from the host to the few fields the UI understands. */
export function sanitizeResult(raw) {
  if (!raw || typeof raw !== 'object') return { success: false, error: 'Bad reply from host' };
  const result = { success: raw.success === true };
  if (raw.error !== undefined) result.error = cleanString(raw.error, 200);
  if (raw.code !== undefined) result.code = cleanString(raw.code, 30);
  if (raw.valid !== undefined) result.valid = raw.valid === true;
  if (raw.word !== undefined) result.word = cleanString(raw.word, 30);
  if (raw.gameOver !== undefined) result.gameOver = raw.gameOver === true;
  if (isInt(raw.score, -10000, 10000)) result.score = raw.score;
  if (Array.isArray(raw.unassignedBlanks) && raw.unassignedBlanks.length <= 7) {
    result.unassignedBlanks = raw.unassignedBlanks
      .filter((b) => b && isInt(b.row, 0, 14) && isInt(b.col, 0, 14))
      .map((b) => ({ row: b.row, col: b.col }));
  }
  return result;
}

export function createGuestSession(peer, seat) {
  let state = null;
  let status = 'connecting'; // connecting | open | closed
  let bad = 0;
  let nextId = 1;
  const pending = new Map(); // id -> { resolve, timer }
  const stateWaiters = [];
  const statusListeners = new Set();
  const stateListeners = new Set();

  const setStatus = (next) => {
    if (status === next) return;
    status = next;
    statusListeners.forEach((fn) => fn(status));
    if (next === 'closed') {
      for (const [, entry] of pending) {
        clearTimeout(entry.timer);
        entry.resolve({ success: false, error: 'Connection to the host was lost' });
      }
      pending.clear();
    }
  };

  const badMessage = (reason) => {
    logWarn(`[Guest] Bad message from host: ${reason}`);
    if (++bad > MAX_BAD_MESSAGES) {
      peer.close();
      setStatus('closed');
    }
  };

  const acceptState = (candidate) => {
    const checked = trySanitizeGameState(candidate);
    if (!checked.ok) return badMessage(`state rejected: ${checked.error}`);
    state = checked.state;
    stateListeners.forEach((fn) => fn(state));
    while (stateWaiters.length) stateWaiters.shift()(state);
  };

  const framing = createFraming({
    send: (frame) => peer.send(frame),
    maxBytes: MAX_GUEST_MESSAGE,
    onViolation: (reason) => badMessage(reason),
    onMessage: (text) => {
      let message;
      try {
        message = safeJsonParse(text, MAX_GUEST_MESSAGE);
      } catch {
        return badMessage('unreadable message');
      }
      if (!message || typeof message !== 'object') return badMessage('message is not an object');
      switch (message.t) {
        case 'hello':
          if (message.seat !== seat) return badMessage('hello for a different seat');
          setStatus('open');
          return acceptState(message.state);
        case 'state':
          return acceptState(message.state);
        case 'result': {
          const entry = isInt(message.id, 0, 1e9) ? pending.get(message.id) : undefined;
          if (!entry) return; // late or unsolicited
          pending.delete(message.id);
          clearTimeout(entry.timer);
          return entry.resolve({ ...sanitizeResult(message.result), gameState: state });
        }
        case 'pong':
          return;
        default:
          return badMessage('unknown message');
      }
    },
  });

  peer.onText = (frame) => framing.receive(frame);
  peer.onOpen = () => {}; // the host speaks first (hello)
  peer.onClose = () => setStatus('closed');

  return {
    seat,
    get status() {
      return status;
    },
    onStatus(fn) {
      statusListeners.add(fn);
      return () => statusListeners.delete(fn);
    },
    onState(fn) {
      stateListeners.add(fn);
      return () => stateListeners.delete(fn);
    },
    close() {
      peer.close();
      setStatus('closed');
    },

    /** An app backend (see net/api.js) that talks to the host. */
    backend: {
      kind: 'guest',
      seat,
      getState: () => (state ? Promise.resolve(state) : new Promise((resolve) => stateWaiters.push(resolve))),
      dispatch(action) {
        if (status === 'closed') return Promise.resolve({ success: false, error: 'Connection to the host was lost', gameState: state });
        const text = JSON.stringify({ t: 'action', id: nextId, action });
        if (text.length > MAX_ACTION_BYTES) return Promise.resolve({ success: false, error: 'Action too large' });
        return new Promise((resolve) => {
          const id = nextId++;
          const timer = setTimeout(() => {
            pending.delete(id);
            resolve({ success: false, error: 'The host did not answer in time', gameState: state });
          }, REQUEST_TIMEOUT_MS);
          pending.set(id, { resolve, timer });
          framing.sendText(JSON.stringify({ t: 'action', id, action }));
        });
      },
      // Practice-mode word queries need the word lists, which only the host has
      words: async () => ({ words: [], count: 0, error: 'Word practice is not available while joined to a game' }),
    },
  };
}

/**
 * Accept an invite: returns the answer text to send back to the host, and the session that becomes active once the
 * host has applied the answer.
 */
export async function acceptInvite(text, { online = false, createPeer = (opts) => new GuestPeer(opts) } = {}) {
  const offer = await decodeSignal(text);
  if (offer.t !== 'offer') throw new ProtocolError('That is an answer, not an invite');
  const peer = createPeer({ online });
  const sdp = await peer.acceptOffer(offer.sdp);
  const answer = await encodeSignal({ t: 'answer', sdp, room: offer.room, seat: offer.seat });
  return { answer, seat: offer.seat, session: createGuestSession(peer, offer.seat) };
}
