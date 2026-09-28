/** Stores the wasm database image in IndexedDB (web/dev only). */
const DB = 'mijote-web';
const STORE = 'files';
const KEY = 'db.sqlite';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
  });
}

export async function loadImage(): Promise<Uint8Array | null> {
  const idb = await open();
  return new Promise((resolve, reject) => {
    const req = idb.transaction(STORE).objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result instanceof Uint8Array ? req.result : null);
    req.onerror = () => reject(req.error ?? new Error('indexedDB read failed'));
  });
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: Uint8Array | null = null;

export function saveImageDebounced(bytes: Uint8Array): void {
  pending = bytes;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const data = pending;
    pending = null;
    if (!data) return;
    void open().then((idb) => idb.transaction(STORE, 'readwrite').objectStore(STORE).put(data, KEY));
  }, 250);
}
