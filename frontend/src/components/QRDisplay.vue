<template>
  <div class="qr-display">
    <div class="qr-header" v-if="!customUrl">
      <h3>{{ playerName }}</h3>
      <p class="qr-instruction">Scan with phone camera to view your letters</p>
      <p class="qr-note">Updates automatically in real time</p>
    </div>
    <div class="qr-code-container">
      <QRCodeVue3
        v-if="qrDataUrl"
        :value="qrDataUrl"
        :width="size"
        :height="size"
        :margin="2"
        :qrOptions="{
          typeNumber: 0,
          mode: 'Byte',
          errorCorrectionLevel: 'L',
        }"
        :dotsOptions="{
          type: 'square',
          color: '#000000',
        }"
        :backgroundOptions="{
          color: '#ffffff',
        }"
      />
      <div v-else class="qr-loading">Loading…</div>
    </div>
    <div class="qr-footer">
      <button @click="openInNewTab" class="copy-button">Preview</button>
    </div>
  </div>
</template>

<script>
import { appUrl } from '../utils/url';
import QRCodeVue3 from 'qrcode-vue3';
import { debug } from '../utils/log';

export default {
  name: 'QRDisplay',
  components: {
    QRCodeVue3,
  },
  props: {
    playerId: {
      type: Number,
      required: true,
    },
    playerName: {
      type: String,
      default: '',
    },
    rack: {
      type: Array,
      default: () => [],
    },
    score: {
      type: Number,
      default: 0,
    },
    customUrl: {
      type: String,
      default: null,
    },
    isCurrentPlayer: {
      type: Boolean,
      default: false,
    },
    size: {
      type: Number,
      default: 350,
    },
  },
  computed: {
    qrDataUrl() {
      if (this.customUrl) return this.customUrl;
      // Generate a URL that can be scanned and opened on a phone
      const url = appUrl(`/rack/${this.playerId}`);
      debug(`QR URL for ${this.playerName}:`, url);
      return url;
    },
  },
  mounted() {
    debug('QRDisplay mounted', {
      playerName: this.playerName,
      rack: this.rack,
      score: this.score,
      dataUrlLength: this.qrDataUrl?.length,
    });
  },
  methods: {
    openInNewTab() {
      window.open(this.qrDataUrl, '_blank');
    },
  },
};
</script>

<style scoped>
.qr-display {
  background: var(--surface-1);
  border: 1px solid var(--surface-edge);
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 12px;
  padding: 15px;
  text-align: center;
  min-width: 380px;
}

.qr-header h3 {
  margin: 0 0 5px 0;
  color: var(--ink);
  font-size: 1.2rem;
}

.qr-instruction {
  margin: 0 0 5px 0;
  font-size: 0.85rem;
  color: var(--ink-muted);
}

.qr-note {
  margin: 0 0 10px 0;
  font-size: 0.75rem;
  color: var(--ink-faint);
  font-style: italic;
}

.qr-code-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 10px;
  min-height: 370px;
}

.qr-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px;
  background: var(--surface-2);
  border-radius: 8px;
  margin-bottom: 10px;
  min-height: 200px;
  color: var(--ink-muted);
  font-size: 0.9rem;
}

.qr-footer {
  margin-top: 10px;
}

.copy-button {
  padding: 8px 16px;
  font-size: 0.9rem;
  font-weight: 600;
  background: var(--surface-2);
  color: var(--ink);
  border: 1px solid var(--surface-edge);
  border-radius: 8px;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out);
  width: 100%;
  min-height: 44px;
}

.copy-button:hover {
  border-color: var(--accent-edge);
}

.copy-button:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}
</style>
