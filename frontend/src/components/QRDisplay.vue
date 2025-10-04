<template>
  <div class="qr-display">
    <div class="qr-header">
      <h3>{{ playerName }}</h3>
      <p class="qr-instruction">Scan with phone camera to view your letters</p>
      <p class="qr-note">Updates automatically in real-time ✨</p>
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
          errorCorrectionLevel: 'L'
        }"
        :dotsOptions="{
          type: 'square',
          color: '#000000'
        }"
        :backgroundOptions="{
          color: '#ffffff'
        }"
      />
      <div v-else style="color: #999;">Loading...</div>
    </div>
    <div class="qr-footer">
      <button @click="openInNewTab" class="copy-button">
        🔍 Preview
      </button>
    </div>
  </div>
</template>

<script>
import QRCodeVue3 from 'qrcode-vue3';

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
      required: true,
    },
    rack: {
      type: Array,
      required: true,
    },
    score: {
      type: Number,
      required: true,
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
      // Generate a URL that can be scanned and opened on a phone
      const url = `${window.location.protocol}//${window.location.host}/rack/${this.playerId}`;
      console.log(`QR URL for ${this.playerName}:`, url);
      return url;
    },
  },
  mounted() {
    console.log('QRDisplay mounted', {
      playerName: this.playerName,
      rack: this.rack,
      score: this.score,
      dataUrlLength: this.qrDataUrl?.length
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
  background: white;
  border-radius: 12px;
  padding: 15px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  text-align: center;
  min-width: 380px;
}

.qr-header h3 {
  margin: 0 0 5px 0;
  color: #333;
  font-size: 1.2rem;
}

.qr-instruction {
  margin: 0 0 5px 0;
  font-size: 0.85rem;
  color: #666;
}

.qr-note {
  margin: 0 0 10px 0;
  font-size: 0.75rem;
  color: #999;
  font-style: italic;
}

.qr-code-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 10px;
  min-height: 370px;
}

.qr-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 10px;
  min-height: 200px;
  color: #666;
  font-size: 0.9rem;
}

.qr-footer {
  margin-top: 10px;
}

.copy-button {
  padding: 8px 16px;
  font-size: 0.9rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
}

.copy-button:hover {
  background: #5568d3;
}

.copy-button:active {
  transform: scale(0.98);
}
</style>
