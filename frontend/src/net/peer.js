// WebRTC wrappers. Both sides expose the same tiny surface so the session logic can be tested with fakes:
//   peer.onOpen(), peer.onText(text), peer.onClose(), peer.send(text), peer.close()
// Pairing needs no server: gathering waits until the local ICE candidates are complete so a single blob holds
// everything (no trickle). Same-room play needs no STUN; `online: true` adds a public STUN server for two devices on
// different networks (a TURN relay may still be needed behind strict carrier NAT).

const STUN = [{ urls: 'stun:stun.l.google.com:19302' }];

function gatherComplete(pc, timeoutMs) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    const onChange = () => pc.iceGatheringState === 'complete' && finish();
    pc.addEventListener('icegatheringstatechange', onChange);
    setTimeout(finish, timeoutMs);
  });
}

class BasePeer {
  constructor({ online = false } = {}) {
    this.online = online;
    this.pc = null;
    this.channel = null;
    this.onOpen = () => {};
    this.onText = () => {};
    this.onClose = () => {};
    this.closed = false;
  }

  _createConnection() {
    this.pc = new RTCPeerConnection({ iceServers: this.online ? STUN : [] });
    this.pc.addEventListener('connectionstatechange', () => {
      if (['failed', 'disconnected', 'closed'].includes(this.pc.connectionState)) this._closed();
    });
  }

  _attach(channel) {
    this.channel = channel;
    channel.addEventListener('open', () => this.onOpen());
    channel.addEventListener('close', () => this._closed());
    channel.addEventListener('message', (event) => {
      if (typeof event.data === 'string') this.onText(event.data); // binary is never expected
    });
  }

  _closed() {
    if (this.closed) return;
    this.closed = true;
    this.onClose();
  }

  get isOpen() {
    return this.channel?.readyState === 'open';
  }

  send(text) {
    if (this.isOpen) this.channel.send(text);
  }

  close() {
    this.closed = true;
    try {
      this.channel?.close();
      this.pc?.close();
    } catch {
      /* already closed */
    }
  }
}

export class HostPeer extends BasePeer {
  /** @returns the offer SDP once local candidates are gathered */
  async createOffer() {
    this._createConnection();
    this._attach(this.pc.createDataChannel('game', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await gatherComplete(this.pc, this.online ? 6000 : 3000);
    return this.pc.localDescription.sdp;
  }

  async acceptAnswer(sdp) {
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
  }
}

export class GuestPeer extends BasePeer {
  /** @returns the answer SDP once local candidates are gathered */
  async acceptOffer(sdp) {
    this._createConnection();
    this.pc.addEventListener('datachannel', (event) => this._attach(event.channel));
    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await gatherComplete(this.pc, this.online ? 6000 : 3000);
    return this.pc.localDescription.sdp;
  }
}
