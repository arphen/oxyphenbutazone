import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createLocalBackend } from './localBackend.js';
import { createWordStore } from './wordStore.js';

const freshStore = () => createWordStore({ indexedDB: new IDBFactory() });
const NONE = { csw21: false, nwl2023: false, enable: false, slovenian: false };
const only = (id) => ({ ...NONE, [id]: true });

const ENABLE = 'cat\ndog\nbird';
const IMPORTED = 'AA a volcanic rock [n -S]\nZZYZX a made-up word\nCAT feline';

/** A deployment shipping only the lists in `files` ({ id: text }), served through a stubbed fetch. */
function shipping(files) {
  const names = { csw21: 'CSW21.txt', nwl2023: 'NWL2023.txt', enable: 'ENABLE.txt', slovenian: 'SLOVENIAN.txt' };
  vi.stubGlobal('fetch', async (url) => {
    const file = String(url).split('/').pop();
    if (file === 'wordlists.json') return new Response(JSON.stringify({ lists: Object.fromEntries(Object.keys(files).map((id) => [id, { file: names[id] }])) }));
    const id = Object.keys(names).find((key) => names[key] === file);
    return id && files[id] !== undefined ? new Response(files[id]) : new Response('not found', { status: 404 });
  });
}

const backendFor = async (wordStore, options = {}) => {
  const backend = createLocalBackend({ persist: false, wordStore, ...options });
  await backend.ready;
  return backend;
};
const valid = async (backend, word) => (await backend.dispatch({ type: 'validate-word', word })).valid;
const select = (backend, selection) => backend.dispatch({ type: 'update-dictionary', dictionaries: selection });

afterEach(() => vi.unstubAllGlobals());

describe('default list loading with imported lists', () => {
  it('uses an imported list from the word store first and offers it as the default English list', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    await wordStore.putList({ id: 'csw21', text: IMPORTED, count: 3, importedAt: 1, fileName: 'csw.txt' });
    const backend = await backendFor(wordStore);
    expect((await backend.getState()).dictionaries).toEqual(only('csw21'));
    expect(await valid(backend, 'zzyzx')).toBe(true);
    expect(await valid(backend, 'bird')).toBe(false); // ENABLE is shipped but not selected
    expect(backend.store.available()).toEqual(['csw21', 'enable']); // union of imported and shipped
  });

  it('prefers the imported text over a shipped file with the same id', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    await wordStore.putList({ id: 'enable', text: 'zzyzx', count: 1, importedAt: 1, fileName: 'e.txt' });
    const backend = await backendFor(wordStore);
    expect(await valid(backend, 'zzyzx')).toBe(true);
    expect(await valid(backend, 'cat')).toBe(false);
  });

  it('falls back to the shipped file when nothing is imported', async () => {
    shipping({ enable: ENABLE });
    const backend = await backendFor(freshStore());
    expect((await backend.getState()).dictionaries).toEqual(only('enable'));
    expect(await valid(backend, 'bird')).toBe(true);
  });

  it('still works with injected loadList and listIds (and ignores the default store)', async () => {
    const backend = await backendFor(freshStore(), { loadList: async (id) => (id === 'enable' ? ENABLE : null), listIds: async () => ['enable'] });
    expect(await valid(backend, 'dog')).toBe(true);
    expect(backend.store.available()).toEqual(['enable']);
  });

  it('survives an unreadable word store', async () => {
    shipping({ enable: ENABLE });
    const broken = { ...freshStore(), init: async () => false, listIds: async () => [], getList: async () => { throw new Error('boom'); } };
    const backend = await backendFor(broken);
    expect(await valid(backend, 'cat')).toBe(true);
  });
});

describe('listStatus', () => {
  it('reports shipped, imported, loaded and count per list', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    await wordStore.putList({ id: 'nwl2023', text: IMPORTED, count: 3, importedAt: 1, fileName: 'n.txt' });
    const backend = await backendFor(wordStore);
    const status = await backend.listStatus();
    // the imported list became the default selection, so it is loaded; the shipped one was not needed yet
    expect(status.nwl2023).toEqual({ shipped: false, imported: true, loaded: true, count: 3, persistent: true });
    expect(status.enable).toEqual({ shipped: true, imported: false, loaded: false, count: 0, persistent: true });
    expect(status.csw21).toEqual({ shipped: false, imported: false, loaded: false, count: 0, persistent: true });
    expect(status.slovenian.shipped).toBe(false);
    expect(Object.keys(status)).toEqual(['csw21', 'nwl2023', 'enable', 'slovenian']);
  });

  it('flags lists as not persistent when the store has no IndexedDB', async () => {
    shipping({ enable: ENABLE });
    const backend = await backendFor(createWordStore({ indexedDB: null }));
    expect((await backend.listStatus()).csw21.persistent).toBe(false);
  });

  it('shows a shipped list that is not loaded yet as shipped with count 0', async () => {
    shipping({ enable: ENABLE, slovenian: 'čaj' });
    const backend = await backendFor(freshStore());
    const { slovenian } = await backend.listStatus();
    expect(slovenian).toMatchObject({ shipped: true, imported: false, loaded: false, count: 0 });
  });
});

describe('importList', () => {
  it('validates, loads and remembers a list so it works at once', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    const backend = await backendFor(wordStore);
    expect(await valid(backend, 'zzyzx')).toBe(false);

    const filler = Array.from({ length: 30 }, (_, i) => `x${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`).join('\r\n');
    const result = await backend.importList('csw21', `\uFEFF${IMPORTED.replace(/\n/g, '\r\n')}\r\n${filler}\r\n1234\r\n`, 'my-csw.txt');
    expect(result).toEqual({ ok: true, count: 33, skipped: 1 });

    await select(backend, only('csw21'));
    expect(await valid(backend, 'zzyzx')).toBe(true);
    expect(backend.store.definition('zzyzx')).toBe('a made-up word');

    const stored = await wordStore.getList('csw21');
    expect(stored).toMatchObject({ id: 'csw21', count: 33, fileName: 'my-csw.txt' });
    expect(stored.importedAt).toBeGreaterThan(1.6e12);
    expect(stored.text.startsWith(IMPORTED)).toBe(true); // cleaned text: BOM and CR are gone
    expect(stored.text).not.toContain('1234');
    expect(stored.text).not.toContain('\r');
    expect((await backend.listStatus()).csw21).toMatchObject({ imported: true, loaded: true, count: 33 });
  });

  it('is remembered by a new backend on the same store (a page reload)', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    await (await backendFor(wordStore)).importList('csw21', IMPORTED, 'x.txt');
    const reloaded = await backendFor(wordStore);
    expect((await reloaded.getState()).dictionaries).toEqual(only('csw21')); // best English list is now the default
    expect(await valid(reloaded, 'zzyzx')).toBe(true);
  });

  it('rebuilds the active words when the list being replaced is currently selected', async () => {
    shipping({ enable: ENABLE });
    const backend = await backendFor(freshStore());
    await backend.importList('enable', 'zzyzx\nqi', 'a.txt');
    expect((await backend.getState()).dictionaries).toEqual(only('enable'));
    expect(await valid(backend, 'zzyzx')).toBe(true);
    expect(await valid(backend, 'cat')).toBe(false); // the shipped words no longer apply
  });

  it('notifies listeners', async () => {
    shipping({ enable: ENABLE });
    const backend = await backendFor(freshStore());
    const seen = vi.fn();
    backend.onChange(seen);
    await backend.importList('csw21', IMPORTED, 'x.txt');
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('refuses a bad file with a message and stores nothing', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    const backend = await backendFor(wordStore);
    const result = await backend.importList('csw21', '<!DOCTYPE html><html><body>nope</body></html>', 'page.txt');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/word list/i);
    expect(await wordStore.listIds()).toEqual([]);
    expect(backend.store.isLoaded('csw21')).toBe(false);
    expect((await backend.listStatus()).csw21.imported).toBe(false);
  });

  it('a refused file leaves an existing imported list untouched', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    const backend = await backendFor(wordStore);
    await backend.importList('csw21', IMPORTED, 'good.txt');
    expect((await backend.importList('csw21', '', 'empty.txt')).ok).toBe(false);
    expect((await wordStore.getList('csw21')).fileName).toBe('good.txt');
    expect(backend.store.size('csw21')).toBe(3);
  });

  it('refuses an unknown list id', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    const backend = await backendFor(wordStore);
    expect((await backend.importList('collins', IMPORTED, 'x.txt')).ok).toBe(false);
    expect((await backend.importList('__proto__', IMPORTED, 'x.txt')).ok).toBe(false);
    expect(await wordStore.listIds()).toEqual([]);
  });

  it('keeps the file name short and free of control characters', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    const backend = await backendFor(wordStore);
    await backend.importList('csw21', IMPORTED, `a\u0000b${'x'.repeat(500)}`);
    const { fileName } = await wordStore.getList('csw21');
    expect(fileName.length).toBe(200);
    expect(fileName.startsWith('ab')).toBe(true);
  });

  it('works while another action is in flight (serialised with dispatch)', async () => {
    shipping({ enable: ENABLE });
    const backend = await backendFor(freshStore());
    const [, imported, state] = await Promise.all([
      backend.dispatch({ type: 'restart', playerCount: 2, language: 'english' }),
      backend.importList('csw21', IMPORTED, 'x.txt'),
      backend.getState(),
    ]);
    expect(imported.ok).toBe(true);
    expect(state.dictionaries).toBeDefined();
    expect(backend.store.size('csw21')).toBe(3);
  });
});

describe('removeList', () => {
  it('forgets an imported list that is not shipped, and falls back when it was the selection', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    const backend = await backendFor(wordStore);
    await backend.importList('csw21', IMPORTED, 'x.txt');
    await select(backend, only('csw21'));
    expect(await valid(backend, 'zzyzx')).toBe(true);

    expect(await backend.removeList('csw21')).toEqual({ ok: true });

    expect(await wordStore.getList('csw21')).toBeNull();
    expect(await valid(backend, 'zzyzx')).toBe(false);
    const state = await backend.getState();
    expect(state.dictionaries).toEqual(only('enable'));
    expect(state.message).toMatch(/CSW21 was removed; using ENABLE instead/);
    expect(await valid(backend, 'bird')).toBe(true);
    expect(await backend.listStatus()).toMatchObject({ csw21: { imported: false, loaded: false, count: 0 } });
    expect(backend.store.available()).toEqual(['enable']);
  });

  it('falls back to a shipped list that was never loaded (a reload after importing, then removing)', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    await wordStore.putList({ id: 'csw21', text: IMPORTED, count: 3, importedAt: 1, fileName: 'x.txt' });
    const backend = await backendFor(wordStore);
    expect((await backend.getState()).dictionaries).toEqual(only('csw21'));
    expect(backend.store.isLoaded('enable')).toBe(false);

    await backend.removeList('csw21');

    expect(backend.store.isLoaded('enable')).toBe(true);
    const state = await backend.getState();
    expect(state.dictionaries).toEqual(only('enable'));
    expect(state.message).toMatch(/CSW21 was removed; using ENABLE instead/);
    expect(await valid(backend, 'cat')).toBe(true);
    expect(await valid(backend, 'zzyzx')).toBe(false);
  });

  it('removing the only list of a Slovenian game that is not shipped says no list is installed', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    const backend = await backendFor(wordStore);
    await backend.dispatch({ type: 'restart', playerCount: 2, language: 'slovenian' });
    await backend.importList('slovenian', 'čaj\nmiza\nkruh\nmleko\nvoda', 'si.txt');
    await select(backend, only('slovenian'));
    expect(await valid(backend, 'miza')).toBe(true);
    await backend.removeList('slovenian');
    const state = await backend.getState();
    expect(state.message).toMatch(/No word list is installed/);
    expect(await valid(backend, 'miza')).toBe(false);
  });

  it('only drops the removed list from a multi-list selection', async () => {
    shipping({ enable: ENABLE });
    const backend = await backendFor(freshStore());
    await backend.importList('csw21', IMPORTED, 'x.txt');
    await select(backend, { ...NONE, csw21: true, enable: true });
    expect(await valid(backend, 'zzyzx')).toBe(true);
    await backend.removeList('csw21');
    expect((await backend.getState()).dictionaries).toEqual(only('enable'));
    expect(await valid(backend, 'zzyzx')).toBe(false);
    expect(await valid(backend, 'cat')).toBe(true);
  });

  it('leaves the selection alone when the removed list was not selected', async () => {
    shipping({ enable: ENABLE });
    const backend = await backendFor(freshStore());
    await select(backend, only('enable'));
    await backend.importList('csw21', IMPORTED, 'x.txt');
    await backend.removeList('csw21');
    const state = await backend.getState();
    expect(state.dictionaries).toEqual(only('enable'));
    expect(state.message).not.toMatch(/not installed/);
  });

  it('does not play on after removal: an imported list that is not shipped stays gone after a reload', async () => {
    shipping({ enable: ENABLE });
    const wordStore = freshStore();
    await (await backendFor(wordStore)).importList('csw21', IMPORTED, 'x.txt');
    await (await backendFor(wordStore)).removeList('csw21');
    const reloaded = await backendFor(wordStore);
    expect((await reloaded.getState()).dictionaries).toEqual(only('enable'));
    expect(await valid(reloaded, 'zzyzx')).toBe(false);
  });

  it('restores the shipped words when the removed list is also shipped', async () => {
    shipping({ enable: ENABLE });
    const backend = await backendFor(freshStore());
    await backend.importList('enable', 'zzyzx', 'x.txt');
    expect(await valid(backend, 'cat')).toBe(false);
    await backend.removeList('enable');
    expect(await valid(backend, 'zzyzx')).toBe(false);
    expect(await valid(backend, 'cat')).toBe(true);
    expect((await backend.listStatus()).enable).toMatchObject({ shipped: true, imported: false, loaded: true, count: 3 });
  });

  it('removing a list that was never imported is harmless', async () => {
    shipping({ enable: ENABLE });
    const backend = await backendFor(freshStore());
    expect(await backend.removeList('nwl2023')).toEqual({ ok: true });
    expect(await valid(backend, 'cat')).toBe(true);
  });

  it('refuses an unknown id', async () => {
    shipping({ enable: ENABLE });
    const backend = await backendFor(freshStore());
    expect((await backend.removeList('nope')).ok).toBe(false);
  });

  it('a list can be imported again after removal', async () => {
    shipping({ enable: ENABLE });
    const backend = await backendFor(freshStore());
    await backend.importList('csw21', IMPORTED, 'x.txt');
    await backend.removeList('csw21');
    await backend.importList('csw21', IMPORTED, 'x.txt');
    await select(backend, only('csw21'));
    expect(await valid(backend, 'zzyzx')).toBe(true);
    expect((await backend.getState()).dictionaries).toEqual(only('csw21'));
  });
});
