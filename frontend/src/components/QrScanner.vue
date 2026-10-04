<template>
  <div class="scanner" role="dialog" aria-modal="true" aria-label="Scan a QR code">
    <div class="scanner-box">
      <p class="scanner-title">{{ title }}</p>

      <div v-show="!problem" class="scanner-view">
        <video ref="video" playsinline muted autoplay></video>
        <div class="scanner-frame" aria-hidden="true"></div>
      </div>

      <p v-if="problem" class="scanner-problem" role="alert">{{ problem }}</p>
      <p v-else-if="notice" class="scanner-notice" role="status">{{ notice }}</p>
      <p v-else class="scanner-hint">{{ starting ? 'Starting the camera…' : 'Point the camera at the QR code.' }}</p>

      <button class="scanner-cancel" @click="cancel">Cancel</button>
    </div>
  </div>
</template>

<script>
import jsQR from 'jsqr';
import { extractCode } from '../net/scan';

const MAX_SIDE = 640; // frames are downscaled to this before decoding
const FRAME_MS = 110; // about 9 decodes per second

export default {
  name: 'QrScanner',
  props: { title: { type: String, default: 'Scan the QR code' } },
  emits: ['scan', 'cancel'],
  data() {
    return { problem: '', notice: '', starting: true };
  },
  mounted() {
    this.start();
  },
  beforeUnmount() {
    this.stop();
  },
  methods: {
    async start() {
      this.stopped = false;
      const devices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
      if (!devices?.getUserMedia) {
        this.problem =
          window.isSecureContext === false
            ? 'The camera only works on a secure (https) page. Please paste the code instead.'
            : 'This browser cannot use the camera. Please paste the code instead.';
        this.starting = false;
        return;
      }
      try {
        const stream = await devices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (this.stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        this.stream = stream;
        const video = this.$refs.video;
        video.srcObject = stream;
        await video.play().catch(() => {}); // autoplay normally handles it; this covers stricter browsers
        if (this.stopped) return;
        this.starting = false;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.lastTime = 0;
        this.raf = requestAnimationFrame(this.tick);
      } catch (error) {
        this.starting = false;
        const name = error?.name;
        this.problem =
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Camera access was denied. Allow the camera in your browser settings, or paste the code instead.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'No camera was found on this device. Please paste the code instead.'
              : 'The camera could not be started. Please paste the code instead.';
      }
    },
    tick(now) {
      if (this.stopped) return;
      this.raf = requestAnimationFrame(this.tick);
      if (now - this.lastTime < FRAME_MS) return;
      this.lastTime = now;
      const video = this.$refs.video;
      if (!video || video.readyState < 2 || !video.videoWidth) return;
      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.ctx.drawImage(video, 0, 0, width, height);
      const image = this.ctx.getImageData(0, 0, width, height);
      const found = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
      if (!found?.data) return;
      const code = extractCode(found.data);
      if (code) {
        this.stop();
        this.$emit('scan', code);
      } else {
        this.notice = 'That QR is not a game code. Try the other one.';
      }
    },
    stop() {
      this.stopped = true;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = null;
      if (this.$refs.video) this.$refs.video.srcObject = null;
    },
    cancel() {
      this.stop();
      this.$emit('cancel');
    },
  },
};
</script>

<style scoped>
.scanner { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.92); display: flex; align-items: center; justify-content: center; padding: 16px; }
.scanner-box { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 12px; align-items: stretch; color: #e4e4e7; }
.scanner-title { margin: 0; font-size: 18px; font-weight: 600; text-align: center; }
.scanner-view { position: relative; background: #000; border-radius: 14px; overflow: hidden; aspect-ratio: 1 / 1; }
.scanner-view video { width: 100%; height: 100%; object-fit: cover; display: block; }
.scanner-frame { position: absolute; inset: 14%; border: 3px solid rgba(255, 255, 255, 0.85); border-radius: 16px; pointer-events: none; }
.scanner-hint, .scanner-notice, .scanner-problem { margin: 0; text-align: center; font-size: 15px; }
.scanner-hint { color: #cbd5e1; }
.scanner-notice { color: #fbbf24; }
.scanner-problem { color: #fca5a5; }
.scanner-cancel { min-height: 48px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.1); color: #fff; font-size: 17px; cursor: pointer; }
</style>
