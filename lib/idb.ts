// Tiny promise-based IndexedDB helper for the client-side flyer cache.
// IndexedDB is used instead of localStorage because cached flyers are large
// (the Ashland Co-op PDF base64 is ~21MB) and localStorage is typically
// capped around 5-10MB per origin.

const DB_NAME = "sales-fliers-cache";
const STORE_NAME = "flyers";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        let result: T | null = null;
        try {
          const req = fn(store);
          if (req) {
            req.onsuccess = () => {
              result = req.result as T;
            };
          }
        } catch {
          // fall through to resolve(null)
        }
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      })
  );
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    return await withStore<T>("readonly", (store) => store.get(key));
  } catch {
    return null;
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.put(value, key));
  } catch {
    // Ignore storage failures so the app keeps working without caching.
  }
}

export async function idbDelete(key: string): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.delete(key));
  } catch {
    // Ignore.
  }
}