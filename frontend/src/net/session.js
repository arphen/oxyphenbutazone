// App-level peer-to-peer state: one reactive object the screens read, plus the actions that drive the host and guest
// sessions. The screens never touch WebRTC; they call these functions and show `net`.

import { reactive } from 'vue';
import { setBackend } from './api.js';
import { createHostSession } from './hostSession.js';
import { acceptInvite } from './guestSession.js';
import { keepAwake } from '../utils/wakeLock.js';

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
export async function joinWithInvite(text, { online = false } = {}) {
  guest?.close();
  const { answer, seat, session } = await acceptInvite(text, { online });
  guest = session;
  net.role = 'guest';
  net.seat = seat;
  net.guestStatus = 'connecting';
  session.onStatus((status) => {
    if (guest !== session) return;
    net.guestStatus = status;
    if (status === 'open') {
      setBackend(session.backend);
      keepAwake(true);
    } else if (status === 'closed') {
      keepAwake(false);
    }
  });
  return answer;
}

/** Leave the joined game (or abandon a pairing in progress) and go back to this device's own game. */
export function leaveGame() {
  guest?.close();
  guest = null;
  keepAwake(false);
  net.role = 'none';
  net.guestStatus = 'idle';
  net.seat = null;
  if (local) setBackend(local);
}
