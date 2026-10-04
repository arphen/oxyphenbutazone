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
          <h2 class="modal-title">
            <span class="title-icon">📱</span>
            Scan to View Player Racks
            <span class="title-pulse">✨</span>
          </h2>
          <p class="modal-subtitle">Each player scans their QR code with their phone camera</p>
        </div>
        
        <!-- QR Grid - 4 Corners -->
        <div class="qr-grid">
          <!-- Top Left - Player 1 -->
          <div class="qr-sector qr-top-left" :class="{ active: players[0]?.isCurrentPlayer }">
            <div class="sector-inner">
              <div class="sector-glow"></div>
              <div class="player-badge">
                <span class="player-icon">👤</span>
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
                    errorCorrectionLevel: 'L'
                  }"
                  :dotsOptions="{
                    type: 'rounded',
                    color: '#1a1a2e'
                  }"
                  :backgroundOptions="{
                    color: '#ffffff'
                  }"
                  :cornersSquareOptions="{
                    type: 'extra-rounded',
                    color: '#3b82f6'
                  }"
                  :cornersDotOptions="{
                    type: 'dot',
                    color: '#3b82f6'
                  }"
                />
              </div>
              <div class="score-display">
                <span class="score-label">Score:</span>
                <span class="score-value">{{ players[0]?.score || 0 }}</span>
              </div>
              <button @click="openPreview(1)" class="preview-button">
                <span>🔍 Preview</span>
              </button>
            </div>
          </div>
          
          <!-- Top Right - Player 2 -->
          <div class="qr-sector qr-top-right" :class="{ active: players[1]?.isCurrentPlayer }">
            <div class="sector-inner">
              <div class="sector-glow"></div>
              <div class="player-badge">
                <span class="player-icon">👤</span>
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
                    errorCorrectionLevel: 'L'
                  }"
                  :dotsOptions="{
                    type: 'rounded',
                    color: '#1a1a2e'
                  }"
                  :backgroundOptions="{
                    color: '#ffffff'
                  }"
                  :cornersSquareOptions="{
                    type: 'extra-rounded',
                    color: '#22c55e'
                  }"
                  :cornersDotOptions="{
                    type: 'dot',
                    color: '#22c55e'
                  }"
                />
              </div>
              <div class="score-display">
                <span class="score-label">Score:</span>
                <span class="score-value">{{ players[1]?.score || 0 }}</span>
              </div>
              <button @click="openPreview(2)" class="preview-button">
                <span>🔍 Preview</span>
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
              <div class="sector-glow"></div>
              <div class="player-badge">
                <span class="player-icon">👤</span>
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
                    errorCorrectionLevel: 'L'
                  }"
                  :dotsOptions="{
                    type: 'rounded',
                    color: '#1a1a2e'
                  }"
                  :backgroundOptions="{
                    color: '#ffffff'
                  }"
                  :cornersSquareOptions="{
                    type: 'extra-rounded',
                    color: '#f59e0b'
                  }"
                  :cornersDotOptions="{
                    type: 'dot',
                    color: '#f59e0b'
                  }"
                />
              </div>
              <div class="score-display">
                <span class="score-label">Score:</span>
                <span class="score-value">{{ players[2]?.score || 0 }}</span>
              </div>
              <button @click="openPreview(3)" class="preview-button">
                <span>🔍 Preview</span>
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
              <div class="sector-glow"></div>
              <div class="player-badge">
                <span class="player-icon">👤</span>
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
                    errorCorrectionLevel: 'L'
                  }"
                  :dotsOptions="{
                    type: 'rounded',
                    color: '#1a1a2e'
                  }"
                  :backgroundOptions="{
                    color: '#ffffff'
                  }"
                  :cornersSquareOptions="{
                    type: 'extra-rounded',
                    color: '#a855f7'
                  }"
                  :cornersDotOptions="{
                    type: 'dot',
                    color: '#a855f7'
                  }"
                />
              </div>
              <div class="score-display">
                <span class="score-label">Score:</span>
                <span class="score-value">{{ players[3]?.score || 0 }}</span>
              </div>
              <button @click="openPreview(4)" class="preview-button">
                <span>🔍 Preview</span>
              </button>
            </div>
          </div>
          
          <!-- Center decoration for 2 players -->
          <div v-if="playerCount === 2" class="center-decoration">
            <div class="decoration-content">
              <div class="decoration-icon">🎮</div>
              <div class="decoration-text">2 Player Game</div>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="modal-footer">
          <div class="footer-instruction">
            <span class="instruction-icon">💡</span>
            <span>Point your phone camera at your QR code • Live updates • No app needed</span>
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
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
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

.modal-container {
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 40px;
  max-width: 1400px;
  width: 100%;
  max-height: 95vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 
    0 25px 50px rgba(0, 0, 0, 0.5),
    0 0 100px rgba(59, 130, 246, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  animation: modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(30px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.close-button {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 48px;
  height: 48px;
  background: rgba(239, 68, 68, 0.2);
  border: 2px solid rgba(239, 68, 68, 0.3);
  border-radius: 50%;
  color: #fca5a5;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  backdrop-filter: blur(10px);
  z-index: 10;
}

.close-button:hover {
  background: rgba(239, 68, 68, 0.3);
  border-color: rgba(239, 68, 68, 0.5);
  transform: rotate(90deg) scale(1.1);
  box-shadow: 0 0 30px rgba(239, 68, 68, 0.4);
}

.close-icon {
  font-size: 24px;
  font-weight: 300;
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
  font-size: 2.5rem;
  font-weight: 700;
  color: #e4e4e7;
  margin: 0 0 10px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.title-icon {
  font-size: 2.5rem;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.title-pulse {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

.modal-subtitle {
  font-size: 1.1rem;
  color: #a1a1aa;
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
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 30px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  overflow: hidden;
}

.sector-inner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, 
    transparent, 
    rgba(255, 255, 255, 0.5), 
    transparent
  );
  animation: shimmer 3s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.qr-sector:hover .sector-inner {
  transform: translateY(-5px);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 15px 35px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(59, 130, 246, 0.2);
}

.sector-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}

.qr-top-left .sector-glow {
  background: radial-gradient(circle, rgba(59, 130, 246, 0.3), transparent 70%);
}

.qr-top-right .sector-glow {
  background: radial-gradient(circle, rgba(34, 197, 94, 0.3), transparent 70%);
}

.qr-bottom-left .sector-glow {
  background: radial-gradient(circle, rgba(245, 158, 11, 0.3), transparent 70%);
}

.qr-bottom-right .sector-glow {
  background: radial-gradient(circle, rgba(168, 85, 247, 0.3), transparent 70%);
}

.qr-sector.active .sector-glow {
  opacity: 1;
  animation: glowPulse 2s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.3;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0.6;
  }
}

.qr-sector.active .sector-inner {
  border-color: rgba(34, 197, 94, 0.5);
  box-shadow: 
    0 0 30px rgba(34, 197, 94, 0.3),
    inset 0 0 30px rgba(34, 197, 94, 0.1);
}

.player-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.qr-sector.active .player-badge {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.5);
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
}

.player-icon {
  font-size: 1.5rem;
  animation: rotate 4s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.player-name {
  font-size: 1.3rem;
  font-weight: 700;
  color: #e4e4e7;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.qr-wrapper {
  background: white;
  padding: 15px;
  border-radius: 16px;
  box-shadow: 
    0 10px 30px rgba(0, 0, 0, 0.3),
    0 0 0 8px rgba(255, 255, 255, 0.1);
  margin-bottom: 20px;
  transition: all 0.3s ease;
}

.qr-sector:hover .qr-wrapper {
  transform: scale(1.05);
  box-shadow: 
    0 15px 40px rgba(0, 0, 0, 0.4),
    0 0 0 8px rgba(255, 255, 255, 0.2);
}

.score-display {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 15px;
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.score-label {
  font-size: 0.9rem;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.score-value {
  font-size: 2rem;
  font-weight: 700;
  color: #60a5fa;
  text-shadow: 0 0 10px rgba(96, 165, 250, 0.5);
}

.preview-button {
  width: 100%;
  padding: 12px 20px;
  background: rgba(59, 130, 246, 0.2);
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: 12px;
  color: #93c5fd;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.preview-button:hover {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
}

.preview-button:active {
  transform: translateY(0);
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
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 30px 40px;
  text-align: center;
  animation: decorationFloat 4s ease-in-out infinite;
}

@keyframes decorationFloat {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-10px) rotate(5deg);
  }
}

.decoration-icon {
  font-size: 4rem;
  margin-bottom: 10px;
}

.decoration-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: #e4e4e7;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.modal-footer {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
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
  color: #a1a1aa;
  font-weight: 500;
}

.instruction-icon {
  font-size: 1.5rem;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
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
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
}

.modal-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

.modal-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
