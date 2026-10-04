// Message framing over a text-only transport (a WebRTC data channel).
//
// Data-channel messages have a size limit, and game state can outgrow it, so JSON is split into frames
// `<id>.<index>.<total>:<chunk>`. The receiving side enforces strict limits on frame size, total message size and the
// number of half-received messages, so a malicious peer cannot make this device buffer unbounded data.

export const CHUNK_SIZE = 12000;
const HEADER = /^(\d{1,9})\.(\d{1,4})\.(\d{1,4}):/;

/**
 * @param send       (frameText) => void
 * @param onMessage  (fullText) => void   called with each completely reassembled message (parse it with safeJsonParse)
 * @param onViolation (reason) => void    called when the peer sent something that breaks the rules (frame dropped)
 * @param maxBytes   largest acceptable reassembled message
 */
export function createFraming({ send, onMessage, onViolation = () => {}, maxBytes, maxPartial = 2 }) {
  let nextId = 1;
  const partial = new Map(); // id -> { total, parts: Map(index -> text), size }

  return {
    sendText(text) {
      const id = nextId++;
      const total = Math.max(1, Math.ceil(text.length / CHUNK_SIZE));
      for (let i = 0; i < total; i++) {
        send(`${id}.${i}.${total}:${text.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)}`);
      }
    },

    receive(frame) {
      if (typeof frame !== 'string' || frame.length > CHUNK_SIZE + 40) return onViolation('frame too large');
      const header = HEADER.exec(frame);
      if (!header) return onViolation('malformed frame');
      const id = Number(header[1]);
      const index = Number(header[2]);
      const total = Number(header[3]);
      const maxFrames = Math.ceil(maxBytes / CHUNK_SIZE) + 1;
      if (total < 1 || total > maxFrames || index >= total) return onViolation('bad frame numbering');
      const payload = frame.slice(header[0].length);

      let entry = partial.get(id);
      if (!entry) {
        if (partial.size >= maxPartial) partial.delete(partial.keys().next().value); // drop the oldest half-message
        entry = { total, parts: new Map(), size: 0 };
        partial.set(id, entry);
      }
      if (entry.total !== total) {
        partial.delete(id);
        return onViolation('inconsistent frame count');
      }
      if (!entry.parts.has(index)) {
        entry.parts.set(index, payload);
        entry.size += payload.length;
      }
      if (entry.size > maxBytes) {
        partial.delete(id);
        return onViolation('message too large');
      }
      if (entry.parts.size === total) {
        partial.delete(id);
        let text = '';
        for (let i = 0; i < total; i++) text += entry.parts.get(i);
        onMessage(text);
      }
    },
  };
}
