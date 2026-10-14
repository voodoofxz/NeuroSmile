// On-device storage (IndexedDB). Nothing here ever leaves the phone.

const DB_NAME = 'bells-palsy-monitor';
const DB_VERSION = 1;

let dbPromise;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('checkins', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('settings');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

// Ask the browser not to evict our data under storage pressure.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* best effort */
  }
}

export const addCheckIn = (rec) => run('checkins', 'readwrite', (s) => s.add(rec));
export const updateCheckIn = (rec) => run('checkins', 'readwrite', (s) => s.put(rec));
export const deleteCheckIn = (id) => run('checkins', 'readwrite', (s) => s.delete(id));
export const getCheckIn = (id) => run('checkins', 'readonly', (s) => s.get(id));

export async function listCheckIns() {
  const all = await run('checkins', 'readonly', (s) => s.getAll());
  return all.sort((a, b) => a.date - b.date);
}

export const getSetting = (key) => run('settings', 'readonly', (s) => s.get(key));
export const setSetting = (key, value) => run('settings', 'readwrite', (s) => s.put(value, key));

export async function clearAll() {
  await run('checkins', 'readwrite', (s) => s.clear());
  await run('settings', 'readwrite', (s) => s.clear());
}
