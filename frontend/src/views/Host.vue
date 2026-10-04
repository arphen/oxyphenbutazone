<template>
  <div class="pair-page">
    <button class="back" @click="$router.push('/')">← Home</button>
    <h1>Host a game</h1>

    <!-- Not hosting yet: choose what to host -->
    <section v-if="net.role !== 'host'" class="card">
      <div v-if="saved" class="resume">
        <p>
          A game is in progress ({{ saved.playerCount }} players, {{ saved.language === 'slovenian' ? 'Slovenščina' : 'English' }}).
        </p>
        <button class="primary" @click="start(true)">▶ Continue it</button>
        <p class="or">or start a new one</p>
      </div>

      <label class="field">Language</label>
      <div class="choices">
        <button v-for="lang in languages" :key="lang.id" class="choice" :class="{ active: setup.language === lang.id }" @click="setup.language = lang.id">
          {{ lang.flag }} {{ lang.label }}
        </button>
      </div>

      <label class="field">Players</label>
      <div class="choices">
        <button v-for="n in [2, 3, 4]" :key="n" class="choice" :class="{ active: setup.playerCount === n }" @click="setup.playerCount = n">{{ n }}</button>
      </div>

      <label class="check">
        <input type="checkbox" v-model="setup.online" />
        <span>Players are on different networks (uses the internet)</span>
      </label>

      <button class="primary" :disabled="busy" @click="start(false)">Start hosting</button>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="link" @click="$router.push('/words')">Word lists: import CSW21 or NWL2023 from a file</button>
    </section>

    <!-- Hosting: one card per guest seat -->
    <template v-else>
      <p class="hint">You are Player 1. Invite each other player below; the invite works by QR code, link or copy &amp; paste.</p>

      <section v-for="seat in guestSeats" :key="seat" class="card">
        <h2>Player {{ seat }}</h2>
        <p v-if="status(seat) === 'open'" class="ok">✓ Connected</p>

        <template v-else>
          <p v-if="status(seat) === 'closed'" class="warn">Connection lost. Invite again to reconnect.</p>

          <button v-if="!ui[seat]?.token" class="primary" :disabled="ui[seat]?.busy" @click="invite(seat)">
            {{ ui[seat]?.busy ? 'Preparing…' : `Invite player ${seat}` }}
          </button>

          <template v-else>
            <SignalBox :text="ui[seat].token" :link="ui[seat].link" :label="`1. Player ${seat} opens the app and scans this, or you send them the link`" />
            <label class="field">2. Scan their answer, or paste it here</label>
            <button class="secondary" @click="scanning = seat">📷 Scan their answer</button>
            <textarea v-model="ui[seat].answer" rows="3" class="paste" placeholder="OXY1…" aria-label="Answer from the other player"></textarea>
            <button class="primary" :disabled="!ui[seat].answer" @click="connect(seat)">Connect</button>
            <button class="link" @click="reset(seat)">Start over</button>
          </template>
          <p v-if="ui[seat]?.error" class="error">{{ ui[seat].error }}</p>
        </template>
      </section>

      <div class="footer">
        <button class="primary" @click="$router.push('/rack/1')">Open my rack (Player 1)</button>
        <button class="link" @click="stop">Stop hosting</button>
      </div>
    </template>
    <QrScanner v-if="scanning" title="Scan the other player's answer" @scan="onScan" @cancel="scanning = null" />
  </div>
</template>

<script>
import QrScanner from '../components/QrScanner.vue';
import SignalBox from '../components/SignalBox.vue';
import { net, startHosting, stopHosting, hostInvite, hostAcceptAnswer } from '../net/session';
import { appUrl } from '../utils/url';

export default {
  name: 'Host',
  components: { SignalBox, QrScanner },
  data() {
    return {
      net,
      setup: { language: 'english', playerCount: 2, online: false },
      languages: [
        { id: 'english', flag: '🇬🇧', label: 'English' },
        { id: 'slovenian', flag: '🇸🇮', label: 'Slovenščina' },
      ],
      saved: null,
      playerCount: 2,
      busy: false,
      error: '',
      ui: {},
      scanning: null, // seat whose answer is being scanned
    };
  },
  computed: {
    guestSeats() {
      return Array.from({ length: this.playerCount - 1 }, (_, i) => i + 2);
    },
  },
  async created() {
    try {
      const state = await (await fetch('/api/game-state')).json();
      this.playerCount = state.playerCount;
      const moves = [1, 2, 3, 4].some((i) => state[`player${i}`]?.history?.length);
      if (moves && !state.gameOver) this.saved = { playerCount: state.playerCount, language: state.language };
      if (!this.saved) this.setup.language = state.language;
    } catch {
      /* no game yet */
    }
  },
  methods: {
    status(seat) {
      return this.net.seats[seat];
    },
    async start(keepGame) {
      this.busy = true;
      this.error = '';
      try {
        if (!keepGame) {
          const result = await (
            await fetch('/api/action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'restart', playerCount: this.setup.playerCount, language: this.setup.language }),
            })
          ).json();
          if (!result.success) throw new Error(result.error || 'Could not start a game');
          this.playerCount = this.setup.playerCount;
        }
        startHosting({ online: this.setup.online });
        this.ui = {};
      } catch (error) {
        this.error = error.message;
      } finally {
        this.busy = false;
      }
    },
    async invite(seat) {
      this.ui[seat] = { busy: true };
      try {
        const token = await hostInvite(seat);
        this.ui[seat] = { token, link: appUrl(`/join?c=${token}`), answer: '', error: '' };
      } catch (error) {
        this.ui[seat] = { error: error.message };
      }
    },
    async connect(seat) {
      this.ui[seat].error = '';
      try {
        await hostAcceptAnswer(this.ui[seat].answer);
      } catch (error) {
        this.ui[seat].error = error.message;
      }
    },
    onScan(code) {
      const seat = this.scanning;
      this.scanning = null;
      if (!seat || !this.ui[seat]?.token) return;
      this.ui[seat].answer = code;
      this.connect(seat);
    },
    reset(seat) {
      this.ui[seat] = {};
    },
    stop() {
      stopHosting();
      this.ui = {};
    },
  },
};
</script>

<style scoped src="./pair.css"></style>
