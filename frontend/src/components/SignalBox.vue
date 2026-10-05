<template>
  <div class="signal-box">
    <p v-if="label" class="signal-label">{{ label }}</p>
    <div class="signal-qr" v-if="qrValue">
      <QRCodeVue3
        :value="qrValue"
        :width="260"
        :height="260"
        :margin="4"
        :qrOptions="{ typeNumber: 0, mode: 'Byte', errorCorrectionLevel: 'L' }"
        :dotsOptions="{ type: 'square', color: '#000000' }"
        :backgroundOptions="{ color: '#ffffff' }"
      />
    </div>
    <textarea
      class="signal-text"
      data-testid="signal-text"
      readonly
      rows="3"
      :value="text"
      @focus="$event.target.select()"
      aria-label="Pairing code"
    ></textarea>
    <p class="signal-hint">
      The QR holds the bare code ({{ text.length }} chars) to keep it as small as possible — the
      in-app scanner reads it. If it will not scan, use Copy / Share to send the link instead.
    </p>
    <div class="signal-actions">
      <button class="signal-btn" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
      <button v-if="canShare" class="signal-btn" @click="share">Share</button>
    </div>
  </div>
</template>

<script>
import QRCodeVue3 from 'qrcode-vue3';

export default {
  name: 'SignalBox',
  components: { QRCodeVue3 },
  props: {
    text: { type: String, required: true }, // the pairing code (bare token; this is what the QR shows)
    link: { type: String, default: '' }, // deep-link carrying the code (opens the join screen); used by Copy / Share, not the QR
    label: { type: String, default: '' },
    shareTitle: { type: String, default: 'Game invite' },
  },
  data() {
    return { copied: false };
  },
  computed: {
    // The QR encodes the bare pairing code, not the (longer) link: the in-app
    // scanner (QrScanner -> extractCode) reads bare tokens, and skipping the
    // origin + path saves roughly one QR version. Copy / Share still send the
    // link, which is what a guest without the app open needs.
    qrValue() {
      return this.text;
    },
    canShare() {
      return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    },
  },
  methods: {
    async copy() {
      const value = this.link || this.text;
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        // Clipboard API unavailable (e.g. insecure context): fall back to selecting the text for a manual copy
        const area = this.$el.querySelector('textarea');
        area.focus();
        area.select();
        document.execCommand?.('copy');
      }
      this.copied = true;
      setTimeout(() => (this.copied = false), 1500);
    },
    async share() {
      try {
        await navigator.share({
          title: this.shareTitle,
          text: this.link ? '' : this.text,
          url: this.link || undefined,
        });
      } catch {
        /* cancelled */
      }
    },
  },
};
</script>

<style scoped>
.signal-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.signal-label {
  margin: 0;
  color: var(--ink-muted);
  font-size: 14px;
}
.signal-qr {
  background: #fff;
  padding: 8px;
  border-radius: 12px;
  line-height: 0;
}
.signal-text {
  width: 100%;
  box-sizing: border-box;
  resize: none;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: var(--ink);
  background: var(--surface-2);
  border: 1px solid var(--surface-edge);
  border-radius: 8px;
  padding: 8px;
}
.signal-actions {
  display: flex;
  gap: 8px;
}
.signal-hint {
  margin: 0;
  color: var(--ink-muted);
  font-size: 12px;
  text-align: center;
  max-width: 300px;
}
.signal-btn {
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid var(--surface-edge);
  background: var(--surface-2);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out);
}
.signal-btn:hover {
  border-color: var(--accent-edge);
}
.signal-btn:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}
</style>
