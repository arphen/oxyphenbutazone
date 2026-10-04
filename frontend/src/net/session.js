// App-level peer-to-peer state: one reactive object the screens read, plus the actions that drive the host and guest
// sessions. The screens never touch WebRTC; they call these functions and show `net`.

import { reactive } from 'vue';
import { setBackend } from './api.js';
import { createHostSession } from './hostSession.js';
import { acceptInvite } from './guestSession.js';
import { keepAwake } from '../utils/wakeLock.js';
import { ProtocolError } from '../shared/protocol.js';

export const net = reactive({
  role: 'none', // 'none' | 'host' | 'guest'
  room: null,
  seats: {}, // host: seat -> 'inviting' | 'waiting' | 'connecting' | 'open' | 'closed'
  seat: null, // guest: my seat
  guestStatus: 'idle', // guest: 'connecting' | 'open' | 'closed'
});

let local = null; // the local backend this device hosts/plays with
let host = null;
let guest = null;
let joinSeq = 0; // each joinWithInvite takes a number; a superseded join must not clobber the newer one

// Where the guest remembers its last seat, so a reloaded guest can be told
// "you were Player N, ask the host for a fresh invite". The invite blob
// itself is NOT stored: it dies with the host's session (new room), and
// keeping it would only invite retrying a dead code. Best-effort: storage
// may be unavailable, and that must never break joining.
const LAST_GUEST_KEY = 'oxyphenbutazone_last_guest_v1';

function rememberGuest(seat) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LAST_GUEST_KEY, JSON.stringify({ v: 1, seat, at: Date.now() }));
  } catch {
    /* storage unavailable or full: joining still works, the hint is just absent */
  }
}

function forgetGuest() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(LAST_GUEST_KEY);
  } catch {
    /* ignore */
  }
}

/** The seat this device last played as a guest, or null. Safe for corrupt storage (returns null). */
export function lastGuestSeat() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LAST_GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) return null;
    if (!Number.isInteger(parsed.seat) || parsed.seat < 2 || parsed.seat > 4) return null;
    return { seat: parsed.seat };
  } catch {
    return null;
  }
}

export function initNet(localBackend) {
  local = localBackend;
}

export const hasLocalBackend = () => local !== null;

export function startHosting({ online = false } = {}) {
  if (!local) {
    throw new Error('Phone-to-phone hosting needs the standalone app. With the laptop dev server, open the page with ?mode=local.');
  }
  host?.close();
  guest?.close();
  setBackend(local);
  host = createHostSession(local, {
    online,
    onChange: (snapshot) => {
      net.room = snapshot.room;
      net.seats = { ...snapshot.seats };
    },
  });
  keepAwake(true);
  net.role = 'host';
  net.room = host.room;
  net.seats = {};
  net.seat = 1;
}

export const hostInvite = (seat) => host.invite(seat);
export const hostAcceptAnswer = (text) => host.acceptAnswer(text);

export function stopHosting() {
  host?.close();
  host = null;
  keepAwake(false);
  net.role = 'none';
  net.seats = {};
}

/** Returns the answer text to send back to the host. The app switches to the host's game once the channel opens. */
export async function joinWithInvite(text, { online = false, createPeer } = {}) {
  const mySeq = ++joinSeq;
  guest?.close();
  guest = null;
  const { answer, seat, session } = await acceptInvite(text, { online, ...(createPeer ? { createPeer } : {}) });
  if (mySeq !== joinSeq) {
    // A newer join (or a leave) started while this one was gathering
    // candidates: drop ours so it can never steal the newer session's place.
    session.close();
    throw new ProtocolError('A newer join replaced this one');
  }
  guest = session;
  net.role = 'guest';
  net.seat = seat;
  net.guestStatus = 'connecting';
  session.onStatus((status) => {
    if (guest !== session) return;
    net.guestStatus = status;
    if (status === 'open') {
      setBackend(session.backend);
      rememberGuest(session.seat);
      keepAwake(true);
    } else if (status === 'closed') {
      keepAwake(false);
    }
  });
  return answer;
}

/** Leave the joined game (or abandon a pairing in progress) and go back to this device's own game. */
export function leaveGame() {
  joinSeq++; // invalidate a join that is still gathering candidates
  guest?.close();
  guest = null;
  forgetGuest();
  keepAwake(false);
  net.role = 'none';
  net.guestStatus = 'idle';
  net.seat = null;
  if (local) setBackend(local);
}
