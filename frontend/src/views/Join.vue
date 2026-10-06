<template>
  <div class="pair-page">
    <button class="back" @click="$router.push('/')">← Home</button>
    <p class="pair-eyebrow">Phone to phone</p>
    <h1>Join a game</h1>

    <section v-if="!answer" class="card">
      <button class="secondary" data-testid="join-scan-btn" @click="scanning = true">
        Scan the host's invite
      </button>
      <label class="field">Or paste the host's invite (or open their link)</label>
      <textarea
        v-model="invite"
        rows="4"
        class="paste"
        data-testid="join-invite"
        placeholder="OXY1…"
        aria-label="Invite from the host"
      ></textarea>
      <p v-if="wasGuestHint" class="hint" data-testid="join-was-guest-hint">{{ wasGuestHint }}</p>

      <label class="check">
        <input type="checkbox" v-model="online" />
        <span>We are on different networks (uses the internet)</span>
      </label>

      <button
        class="primary"
        data-testid="join-submit"
        :disabled="busy || !invite.trim()"
        @click="join"
      >
        {{ busy ? 'Connecting…' : 'Join' }}
      </button>
      <p v-if="error" class="error" data-testid="join-error">{{ error }}</p>
    </section>

    <section v-else class="card">
      <p v-if="net.guestStatus !== 'open'" class="hint">
        Now give this answer to the host: they scan it, or paste it into their screen. This page
        will continue by itself once they connect.
      </p>
      <SignalBox
        :text="answer"
        label="Your answer"
        share-title="Game answer"
        data-testid="join-answer"
      />
      <p class="wait" data-testid="join-wait">
        {{ net.guestStatus === 'open' ? 'Connected' : 'Waiting for the host…' }}
      </p>
      <p v-if="waitingLong" class="hint" data-testid="join-stale-hint">
        Still waiting? Make sure the host scanned this answer. If the host restarted the app, ask
        them for a fresh invite: an invite stops working when the host restarts.
      </p>
      <button class="link" data-testid="join-cancel" @click="cancel">Cancel</button>
    </section>

    <QrScanner
      v-if="scanning"
      title="Scan the host's invite"
      @scan="onScan"
      @cancel="scanning = false"
    />
  </div>
</template>

<script>
import QrScanner from '../components/QrScanner.vue';
import SignalBox from '../components/SignalBox.vue';
import { net, joinWithInvite, leaveGame, lastGuestSeat } from '../net/session';

// How long to wait for the host to apply our answer before suggesting the
// invite may be stale. The invite blob carries no timestamp (the encoding is
// frozen and the phones share no clock), so expiry is positional, not timed:
// the host mints a new room id every session, and an invite for an old room
// never connects. This hint is the TTL messaging for that.
const STALE_WAIT_MS = 20000;

export default {
  name: 'Join',
  components: { SignalBox, QrScanner },
  data() {
    return {
      net,
      invite: '',
      online: false,
      answer: '',
      busy: false,
      error: '',
      scanning: false,
      waitingLong: false,
      waitTimer: null,
      wasGuestHint: '',
    };
  },
  watch: {
    'net.guestStatus'(status) {
      if (status === 'open' && this.answer) this.$router.push(`/rack/${net.seat}`);
      if (status !== 'connecting') this.clearWaitTimer();
    },
  },
  created() {
    // Arriving through an invite link or a scanned QR: the code is in the link
    if (typeof this.$route.query.c === 'string') this.invite = this.$route.query.c;
    // A reloaded guest cannot auto-rejoin (the old invite died with the
    // host's session), but it can be told which seat it was.
    if (!this.invite) {
      const last = lastGuestSeat();
      if (last) {
        this.wasGuestHint = `You were Player ${last.seat} before. Ask the host for a fresh invite to rejoin as Player ${last.seat}.`;
      }
    }
  },
  beforeUnmount() {
    this.clearWaitTimer();
  },
  methods: {
    clearWaitTimer() {
      this.waitingLong = false;
      if (this.waitTimer) {
        clearTimeout(this.waitTimer);
        this.waitTimer = null;
      }
    },
    armWaitTimer() {
      this.clearWaitTimer();
      this.waitTimer = setTimeout(() => {
        // Still no connection: the invite/answer is probably stale, not slow.
        if (this.answer && net.guestStatus !== 'open') this.waitingLong = true;
      }, STALE_WAIT_MS);
    },
    async join() {
      this.busy = true;
      this.error = '';
      try {
        this.answer = await joinWithInvite(this.invite, { online: this.online });
        this.armWaitTimer();
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
      this.clearWaitTimer();
      leaveGame();
      this.answer = '';
    },
  },
};
</script>

<style scoped src="./pair.css"></style>
