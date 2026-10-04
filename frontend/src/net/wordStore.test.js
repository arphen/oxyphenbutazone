import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createWordStore } from './wordStore.js';

const record = (id, text = 'cat\ndog', extra = {}) => ({ id, text, count: text.split('\n').length, importedAt: 1700000000000, fileName: `${id}.txt`, ...extra });

describe('wordStore with IndexedDB', () => {
  it('returns null for a list that was never stored and an empty id list', async () => {
    const store = createWordStore({ indexedDB: new IDBFactory() });
    expect(await store.getList('csw21')).toBeNull();
    expect(await store.listIds()).toEqual([]);
    expect(await store.init()).toBe(true);
    expect(store.persistent).toBe(true);
  });

  it('stores and reads back a record unchanged', async () => {
    const store = createWordStore({ indexedDB: new IDBFactory() });
    const r = record('csw21', 'aa an interjection\nab');
    await store.putList(r);
    expect(await store.getList('csw21')).toEqual(r);
    expect(await store.listIds()).toEqual(['csw21']);
  });

  it('is remembered across store instances sharing the same database (a page reload)', async () => {
    const idb = new IDBFactory();
    await createWordStore({ indexedDB: idb }).putList(record('nwl2023', 'zzyzx'));
    const after = createWordStore({ indexedDB: idb });
    expect((await after.getList('nwl2023')).text).toBe('zzyzx');
    expect(await after.listIds()).toEqual(['nwl2023']);
  });

  it('replaces a list stored under the same id', async () => {
    const store = createWordStore({ indexedDB: new IDBFactory() });
    await store.putList(record('csw21', 'one'));
    await store.putList(record('csw21', 'two\nthree'));
    expect((await store.getList('csw21')).text).toBe('two\nthree');
    expect(await store.listIds()).toEqual(['csw21']);
  });

  it('keeps lists separate by id and lists their ids sorted', async () => {
    const store = createWordStore({ indexedDB: new IDBFactory() });
    await store.putList(record('nwl2023', 'n'));
    await store.putList(record('csw21', 'c'));
    expect(await store.listIds()).toEqual(['csw21', 'nwl2023']);
    expect((await store.getList('csw21')).text).toBe('c');
    expect((await store.getList('nwl2023')).text).toBe('n');
  });

  it('deletes a list and leaves the others; deleting a missing list is harmless', async () => {
    const store = createWordStore({ indexedDB: new IDBFactory() });
    await store.putList(record('csw21'));
    await store.putList(record('enable'));
    await store.deleteList('csw21');
    expect(await store.getList('csw21')).toBeNull();
    expect(await store.listIds()).toEqual(['enable']);
    await expect(store.deleteList('slovenian')).resolves.toBeUndefined();
  });

  it('stores a large (25 MB) list', async () => {
    const store = createWordStore({ indexedDB: new IDBFactory() });
    const text = 'abcdefgh a definition that is fairly long indeed\n'.repeat(520000);
    await store.putList(record('csw21', text));
    expect((await store.getList('csw21')).text.length).toBe(text.length);
  }, 30000);

  it('uses the global indexedDB by default', async () => {
    const store = createWordStore();
    await store.putList(record('slovenian', 'čaj'));
    expect((await store.getList('slovenian')).text).toBe('čaj');
    await store.deleteList('slovenian');
    expect(await store.getList('slovenian')).toBeNull();
  });

  it('uses the database and object store the app documents, keyed by id', async () => {
    const idb = new IDBFactory();
    await createWordStore({ indexedDB: idb }).putList(record('csw21'));
    const db = await new Promise((resolve) => {
      const req = idb.open('oxyphenbutazone-words');
      req.onsuccess = () => resolve(req.result);
    });
    expect([...db.objectStoreNames]).toEqual(['lists']);
    expect(db.transaction('lists', 'readonly').objectStore('lists').keyPath).toBe('id');
    db.close();
  });
});

describe('wordStore without IndexedDB (private mode)', () => {
  const unavailable = () => createWordStore({ indexedDB: null });

  it('falls back to memory and says it is not persistent', async () => {
    const store = unavailable();
    expect(await store.init()).toBe(false);
    expect(store.persistent).toBe(false);
    await store.putList(record('csw21', 'cat'));
    expect((await store.getList('csw21')).text).toBe('cat');
    expect(await store.listIds()).toEqual(['csw21']);
    await store.deleteList('csw21');
    expect(await store.getList('csw21')).toBeNull();
    expect(await store.listIds()).toEqual([]);
  });

  it('forgets everything with a new store instance (closing the app)', async () => {
    const first = unavailable();
    await first.putList(record('csw21'));
    expect(await unavailable().getList('csw21')).toBeNull();
  });

  it('falls back when opening the database throws', async () => {
    const store = createWordStore({
      indexedDB: {
        open: () => {
          throw new Error('SecurityError');
        },
      },
    });
    await store.putList(record('csw21', 'cat'));
    expect(store.persistent).toBe(false);
    expect((await store.getList('csw21')).text).toBe('cat');
  });

  it('falls back when opening the database fails with an error event', async () => {
    const store = createWordStore({
      indexedDB: {
        open() {
          const req = {};
          setTimeout(() => req.onerror?.(), 0);
          return req;
        },
      },
    });
    expect(await store.init()).toBe(false);
    await store.putList(record('enable', 'dog'));
    expect(await store.listIds()).toEqual(['enable']);
  });

  it('keeps the list in memory and turns persistent off when a write fails (e.g. quota exceeded)', async () => {
    const real = new IDBFactory();
    // Same database, but every transaction throws once the connection is open
    const failing = {
      open(name, version) {
        const req = real.open(name, version);
        return {
          get result() {
            return req.result;
          },
          set onupgradeneeded(fn) {
            req.onupgradeneeded = fn;
          },
          set onsuccess(fn) {
            req.onsuccess = () => {
              req.result.transaction = () => {
                throw new Error('QuotaExceededError');
              };
              fn();
            };
          },
          set onerror(fn) {
            req.onerror = fn;
          },
          set onblocked(fn) {
            req.onblocked = fn;
          },
        };
      },
    };
    const store = createWordStore({ indexedDB: failing });
    expect(await store.init()).toBe(true); // it opened fine
    await store.putList(record('nwl2023', 'big'));
    expect(store.persistent).toBe(false);
    expect((await store.getList('nwl2023')).text).toBe('big');
    expect(await store.listIds()).toEqual(['nwl2023']);
    // and nothing reached the real database
    expect(await createWordStore({ indexedDB: real }).getList('nwl2023')).toBeNull();
  });
});
