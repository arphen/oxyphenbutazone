<template>
  <div class="signal-box">
    <p v-if="label" class="signal-label">{{ label }}</p>
    <div class="signal-qr" v-if="qrValue">
      <QRCodeVue3
        :value="qrValue"
        :width="260"
        :height="260"
        :margin="2"
        :qrOptions="{ typeNumber: 0, mode: 'Byte', errorCorrectionLevel: 'L' }"
        :dotsOptions="{ type: 'square', color: '#000000' }"
        :backgroundOptions="{ color: '#ffffff' }"
      />
    </div>
    <textarea class="signal-text" readonly rows="3" :value="text" @focus="$event.target.select()" aria-label="Pairing code"></textarea>
    <div class="signal-actions">
      <button class="signal-btn" @click="copy">{{ copied ? '✓ Copied' : '📋 Copy' }}</button>
      <button v-if="canShare" class="signal-btn" @click="share">📤 Share</button>
    </div>
  </div>
</template>

<script>
import QRCodeVue3 from 'qrcode-vue3';

export default {
  name: 'SignalBox',
  components: { QRCodeVue3 },
  props: {
    text: { type: String, required: true }, // the pairing code
    link: { type: String, default: '' }, // link containing the code (opens the join screen); shown as the QR when given
    label: { type: String, default: '' },
    shareTitle: { type: String, default: 'Game invite' },
  },
  data() {
    return { copied: false };
  },
  computed: {
    qrValue() {
      return this.link || this.text;
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
        await navigator.share({ title: this.shareTitle, text: this.link ? '' : this.text, url: this.link || undefined });
      } catch {
        /* cancelled */
      }
    },
  },
};
</script>

<style scoped>
.signal-box { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.signal-label { margin: 0; color: #cbd5e1; font-size: 14px; }
.signal-qr { background: #fff; padding: 8px; border-radius: 12px; line-height: 0; }
.signal-text {
  width: 100%; box-sizing: border-box; resize: none; font-family: ui-monospace, monospace; font-size: 11px;
  color: #cbd5e1; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 8px;
}
.signal-actions { display: flex; gap: 8px; }
.signal-btn {
  padding: 10px 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.08);
  color: #fff; font-size: 15px; cursor: pointer; min-height: 44px;
}
</style>
