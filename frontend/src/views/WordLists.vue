<template>
  <div class="pair-page">
    <button class="back" @click="$router.push('/')">← Home</button>
    <h1>Word lists</h1>

    <p v-if="!backend" class="hint">The word lists are managed by the laptop host in this mode, so there is nothing to import here.</p>

    <template v-else>
      <p class="hint">
        Some lists cannot be shared with this site, so you can import your own copy from a file on this device. Imported files stay on this
        device only: they are never uploaded, and the installed offline app remembers them.
      </p>
      <p v-if="status && !persistent && hasImported" class="warn">
        This browser is not saving data (private browsing?), so imported lists will be forgotten when you close the app.
      </p>

      <section v-for="list in lists" :key="list.id" class="card" :data-list="list.id">
        <h2>{{ list.label }}</h2>
        <p class="detail">{{ list.detail }}</p>

        <p class="status" :class="statusOf(list.id).kind">
          {{ statusOf(list.id).text }}<template v-if="loadedCount(list.id)"> · {{ loadedCount(list.id).toLocaleString('en') }} words</template>
        </p>

        <input
          :ref="(el) => (inputs[list.id] = el)"
          type="file"
          accept=".txt,text/plain"
          class="file"
          :data-list="list.id"
          :aria-label="`Import ${list.label} from a file`"
          @change="onFile(list.id, $event)"
        />
        <button class="secondary" :disabled="busy[list.id]" @click="inputs[list.id]?.click()">
          {{ busy[list.id] ? 'Importing…' : 'Import from file' }}
        </button>

        <template v-if="isImported(list.id)">
          <button v-if="confirming !== list.id" class="link" :disabled="busy[list.id]" @click="confirming = list.id">Remove</button>
          <div v-else class="confirm">
            <span>Remove the imported {{ list.label }} from this device?</span>
            <button class="link" @click="remove(list.id)">Yes, remove</button>
            <button class="link" @click="confirming = null">Cancel</button>
          </div>
        </template>

        <p v-if="messages[list.id]" :class="messages[list.id].type === 'ok' ? 'ok' : 'error'" role="status">{{ messages[list.id].text }}</p>
      </section>
    </template>
  </div>
</template>

<script>
import { getBackend } from '../net/api';
import { MAX_LIST_BYTES } from '../shared/wordlist';

const LISTS = [
  { id: 'csw21', label: 'CSW21', detail: 'Collins word list 2021 (UK and international tournament play).' },
  { id: 'nwl2023', label: 'NWL2023', detail: 'NASPA Word List 2023 (North American tournament play).' },
  { id: 'enable', label: 'ENABLE (open list)', detail: 'A free word list, built in.' },
  { id: 'slovenian', label: 'Slovenian', detail: 'For games with Slovenian tiles, built in.' },
];

export default {
  name: 'WordLists',
  data() {
    return {
      backend: getBackend(),
      lists: LISTS,
      status: null,
      inputs: {},
      busy: {},
      messages: {},
      confirming: null,
    };
  },
  computed: {
    persistent() {
      return this.status ? Object.values(this.status).every((entry) => entry.persistent) : true;
    },
    hasImported() {
      return this.status ? Object.values(this.status).some((entry) => entry.imported) : false;
    },
  },
  async created() {
    await this.refresh();
  },
  methods: {
    async refresh() {
      if (this.backend?.listStatus) this.status = await this.backend.listStatus();
    },
    isImported(id) {
      return Boolean(this.status?.[id]?.imported);
    },
    loadedCount(id) {
      const entry = this.status?.[id];
      return entry?.loaded ? entry.count : 0;
    },
    statusOf(id) {
      const entry = this.status?.[id];
      if (!entry) return { kind: 'pending', text: 'Checking…' };
      if (entry.imported) return { kind: 'ok', text: entry.shipped ? 'Imported (replaces the built-in copy)' : 'Imported' };
      if (entry.shipped) return { kind: 'ok', text: 'Built in' };
      return { kind: 'missing', text: 'Not installed' };
    },
    async onFile(id, event) {
      const input = event.target;
      const file = input.files?.[0];
      input.value = ''; // so choosing the same file again still fires a change
      if (!file) return;
      this.messages = { ...this.messages, [id]: null };
      this.busy = { ...this.busy, [id]: true };
      try {
        if (file.size > MAX_LIST_BYTES) {
          this.setMessage(id, 'error', `That file is too big for a word list (the limit is ${Math.round(MAX_LIST_BYTES / (1024 * 1024))} MB).`);
          return;
        }
        const text = await file.text();
        await new Promise((resolve) => setTimeout(resolve, 0)); // let "Importing…" paint before the heavy work
        const result = await this.backend.importList(id, text, file.name);
        if (result.ok) {
          const skipped = result.skipped ? ` (${result.skipped} lines that were not words were skipped)` : '';
          this.setMessage(id, 'ok', `Imported ${result.count.toLocaleString('en')} words${skipped}.`);
          try {
            await navigator.storage?.persist?.(); // ask the browser not to evict it when space runs low
          } catch {
            /* not supported */
          }
        } else {
          this.setMessage(id, 'error', result.error);
        }
      } catch {
        this.setMessage(id, 'error', 'Could not read that file.');
      } finally {
        this.busy = { ...this.busy, [id]: false };
        await this.refresh();
      }
    },
    async remove(id) {
      this.confirming = null;
      this.busy = { ...this.busy, [id]: true };
      try {
        const result = await this.backend.removeList(id);
        this.setMessage(id, result.ok ? 'ok' : 'error', result.ok ? 'Removed from this device.' : result.error);
      } catch (error) {
        this.setMessage(id, 'error', error.message || 'Could not remove the list.');
      } finally {
        this.busy = { ...this.busy, [id]: false };
        await this.refresh();
      }
    },
    setMessage(id, type, text) {
      this.messages = { ...this.messages, [id]: { type, text } };
    },
  },
};
</script>

<style scoped src="./pair.css"></style>
<style scoped>
.detail { margin: 0; color: #cbd5e1; font-size: 14px; }
.status { margin: 0; font-weight: 600; }
.status.ok { color: #4ade80; }
.status.missing { color: #fbbf24; }
.status.pending { color: #cbd5e1; }
.file { display: none; }
.confirm { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; font-size: 14px; color: #cbd5e1; }
.hint { text-align: left; margin-bottom: 14px; }
</style>
