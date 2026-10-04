// In-memory stand-ins for HostPeer / GuestPeer (see peer.js) so pairing and play can be tested without WebRTC.
// The "SDP" is a valid minimal data-channel description carrying a random id, which is how the answering side finds
// the host peer. Messages are delivered asynchronously, like a real channel.

const registry = new Map(); // id -> FakeHostPeer

const sdpFor = (id, role) =>
  [
    'v=0',
    `o=- ${Math.floor(Math.random() * 1e9)} 2 IN IP4 127.0.0.1`,
    's=-',
    't=0 0',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    `a=ice-ufrag:${id}`,
    `a=setup:${role}`,
    'a=mid:0',
    'a=sctp-port:5000',
    '',
  ].join('\r\n');

const idOf = (sdp) => /a=ice-ufrag:(\w+)/.exec(sdp)?.[1];

class FakeBase {
  constructor() {
    this.other = null;
    this.open = false;
    this.closed = false;
    this.onOpen = () => {};
    this.onText = () => {};
    this.onClose = () => {};
    this.sent = []; // everything this side sent, for assertions
  }
  get isOpen() {
    return this.open && !this.closed;
  }
  send(text) {
    this.sent.push(text);
    if (!this.isOpen || !this.other) return;
    const other = this.other;
    setTimeout(() => other.closed || other.onText(text), 0);
  }
  /** Test hook: deliver raw text as if the remote side had sent it. */
  inject(text) {
    this.onText(text);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    const other = this.other;
    setTimeout(() => {
      this.onClose();
      if (other && !other.closed) {
        other.closed = true;
        other.open = false;
        other.onClose();
      }
    }, 0);
  }
}

export class FakeHostPeer extends FakeBase {
  async createOffer() {
    this.id = Math.random().toString(36).slice(2, 10);
    registry.set(this.id, this);
    return sdpFor(this.id, 'actpass');
  }
  async acceptAnswer(sdp) {
    // Like the real HostPeer (see peer.js): applying the same answer twice
    // (double scan, double tap) is a no-op instead of a state error.
    if (this.applied) return;
    const guest = this.guest;
    if (!guest || idOf(sdp) !== this.id) throw new Error('answer does not match this invite');
    this.applied = true;
    this.other = guest;
    guest.other = this;
    this.open = guest.open = true;
    setTimeout(() => {
      this.onOpen();
      guest.onOpen();
    }, 0);
  }
}

export class FakeGuestPeer extends FakeBase {
  async acceptOffer(sdp) {
    const host = registry.get(idOf(sdp));
    if (!host) throw new Error('no such host');
    host.guest = this;
    return sdpFor(host.id, 'active');
  }
}
