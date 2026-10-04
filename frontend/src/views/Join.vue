<template>
  <div class="pair-page">
    <button class="back" @click="$router.push('/')">← Home</button>
    <h1>Join a game</h1>

    <section v-if="!answer" class="card">
      <button class="secondary" @click="scanning = true">📷 Scan the host's invite</button>
      <label class="field">Or paste the host's invite (or open their link)</label>
      <textarea v-model="invite" rows="4" class="paste" placeholder="OXY1…" aria-label="Invite from the host"></textarea>

      <label class="check">
        <input type="checkbox" v-model="online" />
        <span>We are on different networks (uses the internet)</span>
      </label>

      <button class="primary" :disabled="busy || !invite.trim()" @click="join">{{ busy ? 'Connecting…' : 'Join' }}</button>
      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <section v-else class="card">
      <p v-if="net.guestStatus !== 'open'" class="hint">
        Now give this answer to the host: they scan it, or paste it into their screen. This page will continue by itself once they connect.
      </p>
      <SignalBox :text="answer" label="Your answer" share-title="Game answer" />
      <p class="wait">{{ net.guestStatus === 'open' ? '✓ Connected!' : '⏳ Waiting for the host…' }}</p>
      <button class="link" @click="cancel">Cancel</button>
    </section>

    <QrScanner v-if="scanning" title="Scan the host's invite" @scan="onScan" @cancel="scanning = false" />
  </div>
</template>

<script>
import QrScanner from '../components/QrScanner.vue';
import SignalBox from '../components/SignalBox.vue';
import { net, joinWithInvite, leaveGame } from '../net/session';

export default {
  name: 'Join',
  components: { SignalBox, QrScanner },
  data() {
    return { net, invite: '', online: false, answer: '', busy: false, error: '', scanning: false };
  },
  watch: {
    'net.guestStatus'(status) {
      if (status === 'open' && this.answer) this.$router.push(`/rack/${net.seat}`);
    },
  },
  created() {
    // Arriving through an invite link or a scanned QR: the code is in the link
    if (typeof this.$route.query.c === 'string') this.invite = this.$route.query.c;
  },
  methods: {
    async join() {
      this.busy = true;
      this.error = '';
      try {
        this.answer = await joinWithInvite(this.invite, { online: this.online });
      } catch (error) {
        this.error = error.message || 'Could not use that invite';
      } finally {
        this.busy = false;
      }
    },
    onScan(code) {
      this.scanning = false;
      this.invite = code;
      this.error = '';
    },
    cancel() {
      leaveGame();
      this.answer = '';
    },
  },
};
</script>

<style scoped src="./pair.css"></style>
