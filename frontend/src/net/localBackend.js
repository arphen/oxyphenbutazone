// A complete game backend that lives in the browser: the shared engine plus the word lists.
// Used for the static build (no server) and by the phone that hosts a peer-to-peer game.

import { createEngine } from '../shared/engine.js';
import { createDictionaryStore, defaultSelectionFor, DICTIONARY_IDS, DICTIONARY_LABELS, ENGLISH_IDS } from '../shared/dictionary.js';
import { trySanitizeGameState, cleanString } from '../shared/protocol.js';
import { validateWordListText } from '../shared/wordlist.js';
import { wordStore as defaultWordStore } from './wordStore.js';
import { assetUrl } from '../utils/url.js';
import { debug, logWarn } from '../utils/log.js';

const OFFICIAL_IDS = ['csw21', 'nwl2023']; // the lists a public deployment cannot ship; players import them

export const WORD_LIST_FILES = { csw21: 'CSW21.txt', nwl2023: 'NWL2023.txt', enable: 'ENABLE.txt', friendly: 'FRIENDLY.txt', slovenian: 'SLOVENIAN.txt' };
const SAVE_KEY = 'oxyphenbutazone_local_game_v1';
const SAVE_SCHEMA = 1; // bump when the stored envelope changes; unknown versions are discarded, never trusted

function readSaved() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Current envelope: { v, state }. A bare state is a save from before
    // envelopes existed and is still honoured. Anything else (unknown
    // version, wrong shape) is discarded: the game restarts fresh rather
    // than loading something untrusted or half-written.
    const candidate = parsed && typeof parsed === 'object' && 'state' in parsed
      ? (parsed.v === SAVE_SCHEMA ? parsed.state : null)
      : parsed;
    if (!candidate) return null;
    const checked = trySanitizeGameState(candidate);
    return checked.ok ? checked.state : null; // anything malformed in storage is ignored, never trusted
  } catch {
    return null;
  }
}

function writeSaved(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_SCHEMA, state }));
  } catch (error) {
    logWarn('[Local] Could not save game:', error?.message);
  }
}

/** Static hosts with single-page-app rules answer a missing file with index.html and a 200: that is not a word list. */
export function looksLikeHtml(text) {
  return /^\s*<(?:!doctype|html|head|body|script|meta)\b/i.test(text.slice(0, 300));
}

export function clearSavedGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * @param options.loadList   async (id) => text | null  - supplies a word list (defaults to the lists the player imported
 *                           on this device, then the files this deployment ships in public/)
 * @param options.listIds    async () => string[]  - which lists this deployment ships (defaults to wordlists.json plus
 *                           the lists imported on this device)
 * @param options.persist    save the game to localStorage after every action (default true)
 * @param options.wordStore  where imported lists are remembered (defaults to IndexedDB; injectable for tests)
 */
export function createLocalBackend({ loadList, listIds, persist = true, wordStore = defaultWordStore } = {}) {
  loadList ??= (id) => defaultLoadList(id, wordStore);
  let shipped = new Set(); // ids this deployment ships (not the imported ones)
  const store = createDictionaryStore();
  const engine = createEngine(store);
  const listeners = new Set();
  const loading = new Map(); // id -> promise
  const missing = new Set();

  async function ensureList(id) {
    if (store.isLoaded(id) || missing.has(id)) return;
    if (!loading.has(id)) {
      loading.set(
        id,
        (async () => {
          const text = await loadList(id);
          if (text && !looksLikeHtml(text)) debug(`[Local] ${id} loaded: ${store.load(id, text)} words`);
          else missing.add(id); // absent, or a host answered a missing file with its HTML fallback page
        })().finally(() => loading.delete(id))
      );
    }
    await loading.get(id);
  }

  const ensureSelection = (selection) => Promise.all(DICTIONARY_IDS.filter((id) => selection[id]).map(ensureList));

  const saved = persist ? readSaved() : null;
  if (saved) {
    engine.restoreState(saved);
    store.setSelection(saved.dictionaries);
  }

  /**
   * If the chosen lists turned out not to be installed, switch to one that is (loading the other lists this
   * deployment ships, best first) so that words can be played at all.
   */
  async function repairSelection() {
    if (store.activeSize > 0) return;
    const state = engine.getState();
    const candidates = (state.language === 'slovenian' ? ['slovenian'] : ENGLISH_IDS).filter((id) => store.available().includes(id));
    for (const id of candidates) {
      await ensureList(id);
      if (!store.isLoaded(id)) continue;
      store.setSelection({ [id]: true });
      state.message = `The chosen word list is not installed; using ${id.toUpperCase()} instead.`;
      state.messageType = 'info';
      state.dictionaries = store.getSelection();
      return;
    }
    state.message = 'No word list is installed yet, so no word can be checked.';
    state.messageType = 'error';
  }

  const ready = (async () => {
    const shippedIds = await (listIds ?? defaultListIds)();
    shipped = new Set(shippedIds);
    // Injected lists (tests) are taken as given; otherwise the lists imported on this device count as available too
    store.declare(listIds ? shippedIds : [...shippedIds, ...(await wordStore.listIds())]);
    // Fresh start: the best English list this deployment ships (CSW21 when present, otherwise the open list)
    if (!saved) {
      store.setSelection(defaultSelectionFor('english', {}, store.available()));
      engine.getState().dictionaries = store.getSelection();
    }
    await ensureSelection(store.getSelection());
    await repairSelection();
  })();
  let queue = Promise.resolve();

  const notify = () => listeners.forEach((fn) => fn(engine.getState()));

  // Like dispatch, list changes run one at a time so they never interleave with an action that loads lists
  const serialize = (run) => {
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
  };

  function afterListChange() {
    engine.getState().dictionaries = store.getSelection();
    if (persist) writeSaved(engine.getState());
    notify();
  }

  return {
    kind: 'local',
    engine,
    store,
    ready,
    /** Word lists that are selected but could not be loaded (e.g. not shipped with this deployment). */
    missingLists: () => [...missing],
    /** Install a list from text the user provided (see the import screen). */
    async installList(id, text) {
      const count = store.load(id, text);
      missing.delete(id);
      return count;
    },
    /** Which lists are shipped / imported / loaded, and whether imported lists survive closing the app. */
    async listStatus() {
      await ready;
      const persistent = await wordStore.init();
      const imported = new Set(await wordStore.listIds());
      return Object.fromEntries(
        DICTIONARY_IDS.map((id) => [
          id,
          { shipped: shipped.has(id), imported: imported.has(id), loaded: store.isLoaded(id), count: store.size(id), persistent },
        ])
      );
    },
    /**
     * Install a list from a file the player chose: validate, load it so it works at once, and remember it on this device.
     * @returns {{ok: true, count, skipped} | {ok: false, error}}
     */
    importList(id, rawText, fileName = '') {
      if (!DICTIONARY_IDS.includes(id)) return Promise.resolve({ ok: false, error: 'That word list is not known to this app.' });
      const checked = validateWordListText(rawText);
      if (!checked.ok) return Promise.resolve(checked);
      return serialize(async () => {
        await ready;
        const count = store.load(id, checked.text); // rebuilds the active words when this list is selected
        missing.delete(id);
        store.declare([id]);
        await wordStore.putList({ id, text: checked.text, count, importedAt: Date.now(), fileName: cleanString(String(fileName), 200) });
        // Someone who imports an official list wants to play with it: if an English game is only using the open list
        // (or nothing official), switch to the new one instead of leaving them on ENABLE without noticing.
        const state = engine.getState();
        const selection = store.getSelection();
        if (OFFICIAL_IDS.includes(id) && state.language === 'english' && !OFFICIAL_IDS.some((other) => selection[other])) {
          store.setSelection({ [id]: true });
          state.message = `${DICTIONARY_LABELS[id]} imported; now using it.`;
          state.messageType = 'info';
        }
        afterListChange();
        return { ok: true, count, skipped: checked.skipped };
      });
    },
    /** Forget an imported list. A list this deployment ships is reloaded from its file; any other is unloaded. */
    removeList(id) {
      if (!DICTIONARY_IDS.includes(id)) return Promise.resolve({ ok: false, error: 'That word list is not known to this app.' });
      return serialize(async () => {
        await ready;
        await wordStore.deleteList(id);
        if (shipped.has(id)) {
          const text = await loadList(id);
          if (text) store.load(id, text);
        } else {
          store.load(id, '');
          store.undeclare([id]);
          missing.add(id);
          const selection = store.getSelection();
          if (selection[id]) {
            const rest = { ...selection, [id]: false };
            const state = engine.getState();
            if (DICTIONARY_IDS.some((other) => rest[other])) {
              store.setSelection(rest);
            } else {
              // It was the only list in use: switch to the best one still available (it may not be loaded yet)
              const next = defaultSelectionFor(state.language, {}, store.available());
              store.setSelection(next);
              await ensureSelection(next);
              await repairSelection(); // nothing left to load? then it says no list is installed
              if (store.activeSize > 0) {
                state.message = `${DICTIONARY_LABELS[id]} was removed; using ${DICTIONARY_IDS.filter((other) => next[other]).map((other) => DICTIONARY_LABELS[other]).join(' + ')} instead.`;
                state.messageType = 'info';
              }
            }
          }
        }
        afterListChange();
        return { ok: true };
      });
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async getState() {
      await ready;
      return engine.getState();
    },
    /** @param ctx { playerId } pins player-bound actions to that seat (used for P2P guests) */
    dispatch(action, ctx) {
      // One action at a time: loading a word list below must not interleave with another action.
      const run = async () => {
        await ready;
        const result = engine.dispatch(action, ctx);
        // The action may have selected a list that is not loaded yet (e.g. switching to Slovenian)
        await ensureSelection(store.getSelection());
        await repairSelection();
        if (action?.type !== 'validate-word') {
          if (persist) writeSaved(engine.getState());
          notify();
        }
        return result;
      };
      queue = queue.then(run, run);
      return queue;
    },
    async words(query) {
      await ready;
      // A query for one specific list (practice modes) must work even if that list is not the one being played with
      if (query?.dictionary && DICTIONARY_IDS.includes(query.dictionary)) await ensureList(query.dictionary);
      return store.words(query);
    },
  };
}

async function defaultLoadList(id, wordStore) {
  try {
    const imported = await wordStore.getList(id);
    if (imported?.text) return imported.text;
  } catch {
    /* unreadable storage: fall back to the shipped file */
  }
  try {
    const response = await fetch(assetUrl(WORD_LIST_FILES[id]));
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function defaultListIds() {
  try {
    const response = await fetch(assetUrl('wordlists.json'));
    if (!response.ok) return [];
    const { lists } = await response.json();
    return Object.keys(lists || {});
  } catch {
    return [];
  }
}
