/**
 * Async IndexedDB persistence for per-project version timelines.
 *
 * The timeline is opaque JSON-serializable data keyed by project id. This
 * module is standalone (no app types) and robust: a missing `indexedDB`
 * (SSR / non-jsdom test) or a failed read resolves to null / no-ops rather
 * than throwing, so callers never have to guard.
 */

const DB_NAME = 'occad-versions';
const STORE_NAME = 'timelines';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

/** Open (and cache) the database. Resolves null when IndexedDB is unavailable. */
function openDB(): Promise<IDBDatabase | null> {
  if (!hasIndexedDB()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.warn('versionStorage: failed to open IndexedDB', req.error);
      resolve(null);
    };
  });
  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

/** Persist a timeline for a project. Silently no-ops if IndexedDB is unavailable. */
export async function saveTimeline(projectId: string, timeline: unknown): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const req = tx(db, 'readwrite').put(timeline, projectId);
      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn('versionStorage: save failed', req.error);
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

/** Load a project's timeline, or null if none is stored / IndexedDB unavailable. */
export async function loadTimeline(projectId: string): Promise<unknown | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise<unknown | null>((resolve) => {
    try {
      const req = tx(db, 'readonly').get(projectId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => {
        console.warn('versionStorage: load failed', req.error);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/** Remove a project's stored timeline. */
export async function deleteTimeline(projectId: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const req = tx(db, 'readwrite').delete(projectId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * A debounced saver: coalesces rapid saves per projectId so the store can call
 * it on every change without hammering IndexedDB. The latest timeline wins.
 */
export function createDebouncedSaver(delayMs = 400): (projectId: string, timeline: unknown) => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return (projectId, timeline) => {
    const existing = timers.get(projectId);
    if (existing) clearTimeout(existing);
    timers.set(
      projectId,
      setTimeout(() => {
        timers.delete(projectId);
        void saveTimeline(projectId, timeline);
      }, delayMs)
    );
  };
}
