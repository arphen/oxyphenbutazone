// A complete game backend that lives in the browser: the shared engine plus the word lists.
// Used for the static build (no server) and by the phone that hosts a peer-to-peer game.

import { createEngine } from '../shared/engine.js';
import { createDictionaryStore, defaultSelectionFor, DICTIONARY_IDS, ENGLISH_IDS } from '../shared/dictionary.js';
import { trySanitizeGameState } from '../shared/protocol.js';
import { assetUrl } from '../utils/url.js';
import { debug, logWarn } from '../utils/log.js';

export const WORD_LIST_FILES = { csw21: 'CSW21.txt', nwl2023: 'NWL2023.txt', enable: 'ENABLE.txt', slovenian: 'SLOVENIAN.txt' };
const SAVE_KEY = 'oxyphenbutazone_local_game_v1';

function readSaved() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const checked = trySanitizeGameState(JSON.parse(raw));
    return checked.ok ? checked.state : null; // anything malformed in storage is ignored, never trusted
  } catch {
    return null;
  }
}

function writeSaved(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
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
 * @param options.loadList   async (id) => text | null  - supplies a word list (defaults to fetching public/ files)
 * @param options.listIds    async () => string[]  - which lists this deployment ships (defaults to wordlists.json)
 * @param options.persist    save the game to localStorage after every action (default true)
 */
export function createLocalBackend({ loadList = defaultLoadList, listIds = defaultListIds, persist = true } = {}) {
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
    store.declare(await listIds());
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
      return store.words(query);
    },
  };
}

async function defaultLoadList(id) {
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
