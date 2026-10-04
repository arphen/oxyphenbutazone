// Remembers word lists the player imported from a file (the copyrighted CSW21 / NWL2023 lists are not shipped with a
// public deployment). They live in IndexedDB on this device only: object store keyed by list id, records
// { id, text, count, importedAt, fileName }. Where IndexedDB is unavailable (private mode, blocked storage) an
// in-memory Map takes over and `persistent` turns false, so the UI can warn that the list is forgotten on close.

const DB_NAME = 'oxyphenbutazone-words';
const STORE = 'lists';

/** @param options.indexedDB  injectable for tests; defaults to the browser's */
export function createWordStore({ indexedDB: idb = typeof indexedDB === 'undefined' ? undefined : indexedDB } = {}) {
  const memory = new Map();
  let persistent = Boolean(idb);
  let dbPromise = null;

  const request = (req) =>
    new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
    });

  /** The open database, or null when IndexedDB cannot be used (then `persistent` is false). */
  function open() {
    if (!idb) return Promise.resolve(null);
    if (!dbPromise) {
      dbPromise = new Promise((resolve) => {
        let opening;
        try {
          opening = idb.open(DB_NAME, 1);
        } catch {
          resolve(null);
          return;
        }
        opening.onupgradeneeded = () => {
          if (!opening.result.objectStoreNames.contains(STORE)) opening.result.createObjectStore(STORE, { keyPath: 'id' });
        };
        opening.onsuccess = () => {
          opening.result.onversionchange = () => opening.result.close();
          resolve(opening.result);
        };
        opening.onerror = () => resolve(null);
        opening.onblocked = () => resolve(null);
      }).then((db) => {
        if (!db) persistent = false;
        return db;
      });
    }
    return dbPromise;
  }

  async function run(mode, action) {
    const db = await open();
    if (!db) return { used: false };
    try {
      const tx = db.transaction(STORE, mode);
      const done = new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
      });
      const value = await request(action(tx.objectStore(STORE)));
      if (mode === 'readwrite') await done;
      return { used: true, value };
    } catch {
      return { used: false, failed: true };
    }
  }

  return {
    /** Is the app able to remember lists across visits? Settles once IndexedDB has been tried. */
    async init() {
      await open();
      return persistent;
    },
    get persistent() {
      return persistent;
    },
    /** @returns the stored record or null */
    async getList(id) {
      const result = await run('readonly', (store) => store.get(id));
      if (result.used) return result.value ?? memory.get(id) ?? null;
      return memory.get(id) ?? null;
    },
    /** Store (or replace) a list. If the browser refuses (e.g. quota), it is kept in memory only and `persistent` turns false. */
    async putList(record) {
      const result = await run('readwrite', (store) => store.put(record));
      if (result.used) {
        memory.delete(record.id);
        return;
      }
      if (result.failed) persistent = false;
      memory.set(record.id, record);
    },
    async deleteList(id) {
      memory.delete(id);
      const result = await run('readwrite', (store) => store.delete(id));
      if (result.failed) throw new Error('Could not remove the word list from this device.');
    },
    /** Ids of the stored lists, sorted. */
    async listIds() {
      const result = await run('readonly', (store) => store.getAllKeys());
      const ids = new Set(result.used ? result.value : []);
      for (const id of memory.keys()) ids.add(id);
      return [...ids].sort();
    },
  };
}

/** The app-wide store. */
export const wordStore = createWordStore();
