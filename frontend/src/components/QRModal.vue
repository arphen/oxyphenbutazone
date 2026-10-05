<template>
  <transition name="modal-fade">
    <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-container" @click.stop>
        <!-- Close Button -->
        <button class="close-button" @click="close" title="Close (ESC)">
          <span class="close-icon">✕</span>
        </button>

        <!-- Modal Title -->
        <div class="modal-header">
          <h2 class="modal-title">Scan to view player racks</h2>
          <p class="modal-subtitle">Each player scans their QR code with their phone camera</p>
        </div>

        <!-- QR Grid - 4 Corners -->
        <div class="qr-grid">
          <!-- Top Left - Player 1 -->
          <div class="qr-sector qr-top-left" :class="{ active: players[0]?.isCurrentPlayer }">
            <div class="sector-inner">
              <div class="player-badge">
                <span class="player-seat">P1</span>
                <span class="player-name">{{ players[0]?.name || 'Player 1' }}</span>
              </div>
              <div class="qr-wrapper">
                <QRCodeVue3
                  v-if="getQRDataUrl(1)"
                  :value="getQRDataUrl(1)"
                  :width="qrSize"
                  :height="qrSize"
                  :margin="2"
                  :qrOptions="{
                    typeNumber: 0,
                    mode: 'Byte',
                    errorCorrectionLevel: 'L',
                  }"
                  :dotsOptions="{
                    type: 'rounded',
                    color: '#1a1a2e',
                  }"
                  :backgroundOptions="{
                    color: '#ffffff',
                  }"
                  :cornersSquareOptions="{
                    type: 'extra-rounded',
                    color: '#1d4ed8',
                  }"
                  :cornersDotOptions="{
                    type: 'dot',
                    color: '#1d4ed8',
                  }"
                />
              </div>
              <div class="score-display">
                <span class="score-label">Score:</span>
                <span class="score-value">{{ players[0]?.score || 0 }}</span>
              </div>
              <button @click="openPreview(1)" class="preview-button">
                <span>Preview</span>
              </button>
            </div>
          </div>

          <!-- Top Right - Player 2 -->
          <div class="qr-sector qr-top-right" :class="{ active: players[1]?.isCurrentPlayer }">
            <div class="sector-inner">
              <div class="player-badge">
                <span class="player-seat">P2</span>
                <span class="player-name">{{ players[1]?.name || 'Player 2' }}</span>
              </div>
              <div class="qr-wrapper">
                <QRCodeVue3
                  v-if="getQRDataUrl(2)"
                  :value="getQRDataUrl(2)"
                  :width="qrSize"
                  :height="qrSize"
                  :margin="2"
                  :qrOptions="{
                    typeNumber: 0,
                    mode: 'Byte',
                    errorCorrectionLevel: 'L',
                  }"
                  :dotsOptions="{
                    type: 'rounded',
                    color: '#1a1a2e',
                  }"
                  :backgroundOptions="{
                    color: '#ffffff',
                  }"
                  :cornersSquareOptions="{
                    type: 'extra-rounded',
                    color: '#1d4ed8',
                  }"
                  :cornersDotOptions="{
                    type: 'dot',
                    color: '#1d4ed8',
                  }"
                />
              </div>
              <div class="score-display">
                <span class="score-label">Score:</span>
                <span class="score-value">{{ players[1]?.score || 0 }}</span>
              </div>
              <button @click="openPreview(2)" class="preview-button">
                <span>Preview</span>
              </button>
            </div>
          </div>

          <!-- Bottom Left - Player 3 -->
          <div
            v-if="playerCount >= 3"
            class="qr-sector qr-bottom-left"
            :class="{ active: players[2]?.isCurrentPlayer }"
          >
            <div class="sector-inner">
              <div class="player-badge">
                <span class="player-seat">P3</span>
                <span class="player-name">{{ players[2]?.name || 'Player 3' }}</span>
              </div>
              <div class="qr-wrapper">
                <QRCodeVue3
                  v-if="getQRDataUrl(3)"
                  :value="getQRDataUrl(3)"
                  :width="qrSize"
                  :height="qrSize"
                  :margin="2"
                  :qrOptions="{
                    typeNumber: 0,
                    mode: 'Byte',
                    errorCorrectionLevel: 'L',
                  }"
                  :dotsOptions="{
                    type: 'rounded',
                    color: '#1a1a2e',
                  }"
                  :backgroundOptions="{
                    color: '#ffffff',
                  }"
                  :cornersSquareOptions="{
                    type: 'extra-rounded',
                    color: '#1d4ed8',
                  }"
                  :cornersDotOptions="{
                    type: 'dot',
                    color: '#1d4ed8',
                  }"
                />
              </div>
              <div class="score-display">
                <span class="score-label">Score:</span>
                <span class="score-value">{{ players[2]?.score || 0 }}</span>
              </div>
              <button @click="openPreview(3)" class="preview-button">
                <span>Preview</span>
              </button>
            </div>
          </div>

          <!-- Bottom Right - Player 4 -->
          <div
            v-if="playerCount >= 4"
            class="qr-sector qr-bottom-right"
            :class="{ active: players[3]?.isCurrentPlayer }"
          >
            <div class="sector-inner">
              <div class="player-badge">
                <span class="player-seat">P4</span>
                <span class="player-name">{{ players[3]?.name || 'Player 4' }}</span>
              </div>
              <div class="qr-wrapper">
                <QRCodeVue3
                  v-if="getQRDataUrl(4)"
                  :value="getQRDataUrl(4)"
                  :width="qrSize"
                  :height="qrSize"
                  :margin="2"
                  :qrOptions="{
                    typeNumber: 0,
                    mode: 'Byte',
                    errorCorrectionLevel: 'L',
                  }"
                  :dotsOptions="{
                    type: 'rounded',
                    color: '#1a1a2e',
                  }"
                  :backgroundOptions="{
                    color: '#ffffff',
                  }"
                  :cornersSquareOptions="{
                    type: 'extra-rounded',
                    color: '#1d4ed8',
                  }"
                  :cornersDotOptions="{
                    type: 'dot',
                    color: '#1d4ed8',
                  }"
                />
              </div>
              <div class="score-display">
                <span class="score-label">Score:</span>
                <span class="score-value">{{ players[3]?.score || 0 }}</span>
              </div>
              <button @click="openPreview(4)" class="preview-button">
                <span>Preview</span>
              </button>
            </div>
          </div>

          <!-- Center decoration for 2 players -->
          <div v-if="playerCount === 2" class="center-decoration">
            <div class="decoration-content">
              <div class="decoration-text">2 Player Game</div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <div class="footer-instruction">
            <span>Point your phone camera at your QR code · Live updates · No app needed</span>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
import { appUrl } from '../utils/url';
import QRCodeVue3 from 'qrcode-vue3';

export default {
  name: 'QRModal',
  components: {
    QRCodeVue3,
  },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    players: {
      type: Array,
      default: () => [],
    },
    playerCount: {
      type: Number,
      default: 2,
    },
  },
  computed: {
    qrSize() {
      // Dynamic size based on player count
      return this.playerCount === 2 ? 280 : 220;
    },
  },
  watch: {
    show(newVal) {
      if (newVal) {
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', this.handleEscKey);
      } else {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', this.handleEscKey);
      }
    },
  },
  beforeUnmount() {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', this.handleEscKey);
  },
  methods: {
    close() {
      this.$emit('close');
    },
    handleOverlayClick() {
      this.close();
    },
    handleEscKey(event) {
      if (event.key === 'Escape') {
        this.close();
      }
    },
    getQRDataUrl(playerId) {
      const url = appUrl(`/rack/${playerId}`);
      return url;
    },
    openPreview(playerId) {
      window.open(this.getQRDataUrl(playerId), '_blank');
    },
  },
};
</script>

<style scoped>
/* Finite motion only (R14): every animation below runs once. A scanner that
   kept spinning never let the eye rest; state stays visible, motion stops. */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
  animation: overlayFadeIn 0.3s ease-out;
}

@keyframes overlayFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* One floating glass instrument (R10): everything inside it stays matte. */
.modal-container {
  background: color-mix(in oklab, var(--surface-1, #161c24) 76%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid color-mix(in oklab, var(--ink, #f2f2f6) 10%, transparent);
  box-shadow:
    inset 0 1px 0 var(--surface-glint, #ffffff14),
    0 18px 40px -18px rgba(0, 0, 0, 0.6),
    0 2px 6px rgba(0, 0, 0, 0.3);
  border-radius: 20px;
  padding: 40px;
  max-width: 1400px;
  width: 100%;
  max-height: 95vh;
  overflow-y: auto;
  position: relative;
  animation: modalSlideIn 0.4s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.close-button {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  background: var(--surface-2);
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.2));
  border-radius: 50%;
  color: var(--ink);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out);
  z-index: 10;
}

.close-button:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.close-button:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}

.close-icon {
  font-size: 20px;
  font-weight: 400;
  line-height: 1;
}

.modal-header {
  text-align: center;
  margin-bottom: 40px;
  animation: fadeInDown 0.5s ease-out 0.1s backwards;
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 10px 0;
}

.modal-subtitle {
  font-size: 1rem;
  color: var(--ink-muted, #a1a1aa);
  margin: 0;
  font-weight: 400;
}

.qr-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 30px;
  margin-bottom: 30px;
  position: relative;
  min-height: 600px;
}

.qr-sector {
  position: relative;
  animation: sectorFadeIn 0.6s ease-out backwards;
}

.qr-top-left {
  animation-delay: 0.2s;
}

.qr-top-right {
  animation-delay: 0.3s;
}

.qr-bottom-left {
  animation-delay: 0.4s;
}

.qr-bottom-right {
  animation-delay: 0.5s;
}

@keyframes sectorFadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.sector-inner {
  position: relative;
  background: var(--surface-2);
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
  box-shadow: inset 0 1px 0 var(--surface-glint);
  border-radius: 16px;
  padding: 30px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out);
  overflow: hidden;
}

.qr-sector:hover .sector-inner {
  transform: translateY(-2px);
  border-color: var(--accent-edge);
}

/* The current player's sector is one steady state: full light, accent edge.
   The seat number names the seat, so no per-seat hue is spent (R1). */
.qr-sector.active .sector-inner {
  border-color: var(--accent-edge);
  background: var(--accent-soft);
}

.player-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding: 10px 20px;
  background: var(--surface-3);
  border-radius: 50px;
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.2));
}

.player-seat {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
}

.qr-sector.active .player-seat {
  color: var(--ink);
}

.player-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ink);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.qr-wrapper {
  background: white;
  padding: 15px;
  border-radius: 12px;
  box-shadow: var(--shadow-sm, 0 10px 30px rgba(0, 0, 0, 0.3));
  margin-bottom: 20px;
}

.score-display {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 15px;
  padding: 10px 20px;
  background: var(--surface-3);
  border-radius: 12px;
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
}

.score-label {
  font-size: 0.9rem;
  color: var(--ink-muted, #a1a1aa);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.score-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.preview-button {
  width: 100%;
  padding: 12px 20px;
  background: var(--surface-2);
  border: 1px solid var(--surface-edge, rgba(59, 130, 246, 0.3));
  border-radius: 12px;
  color: var(--ink);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.preview-button:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.preview-button:active {
  transform: translateY(0) scale(0.97);
  transition-duration: 60ms;
}

.center-decoration {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  pointer-events: none;
}

.decoration-content {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
  border-radius: 16px;
  padding: 30px 40px;
  text-align: center;
}

.decoration-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ink);
  text-transform: uppercase;
  letter-spacing: 2px;
}

.modal-footer {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
  animation: fadeInUp 0.5s ease-out 0.3s backwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.footer-instruction {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 1rem;
  color: var(--ink-muted, #a1a1aa);
  font-weight: 500;
}

/* Modal transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 1024px) {
  .modal-container {
    padding: 30px 20px;
  }

  .modal-title {
    font-size: 2rem;
  }

  .qr-grid {
    gap: 20px;
    min-height: 500px;
  }

  .sector-inner {
    padding: 20px;
  }
}

@media (max-width: 768px) {
  .modal-container {
    padding: 20px;
    max-height: 100vh;
    border-radius: 16px;
  }

  .modal-title {
    font-size: 1.5rem;
    flex-direction: column;
    gap: 10px;
  }

  .qr-grid {
    grid-template-columns: 1fr;
    gap: 15px;
    min-height: auto;
  }

  .center-decoration {
    display: none;
  }

  .sector-inner {
    padding: 15px;
  }

  .player-badge {
    margin-bottom: 15px;
  }

  .score-value {
    font-size: 1.5rem;
  }
}

/* Scrollbar styling */
.modal-container::-webkit-scrollbar {
  width: 8px;
}

.modal-container::-webkit-scrollbar-track {
  background: var(--surface-2);
  border-radius: 10px;
}

.modal-container::-webkit-scrollbar-thumb {
  background: var(--surface-edge);
  border-radius: 10px;
}

.modal-container::-webkit-scrollbar-thumb:hover {
  background: var(--ink-faint);
}
</style>
