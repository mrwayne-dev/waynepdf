import { openDB } from 'idb';

/*
 * IndexedDB, the document store.
 *
 * localStorage is the wrong home for documents: it is synchronous (so a large
 * paste janks the editor), capped around 5 MB across the whole origin, and
 * string-only. IndexedDB is async, orders of magnitude larger, and stores
 * structured records directly.
 *
 * `idb` rather than raw IndexedDB — about 1 KB gzipped for a promise-based API
 * over an event-based one. The raw request/onsuccess dance is the single most
 * error-prone part of the platform.
 *
 * Two stores:
 *   documents  keyed on `id`  -> { id, title, body, createdAt, updatedAt }
 *   meta       out-of-line    -> 'app' holds { activeDocumentId, documentOrder }
 *
 * Order lives in `meta` rather than as an index on `documents` because tab order
 * is a user-arranged sequence, not a property derivable from any document field.
 */

export const DB_NAME = 'waynepdf';
export const DB_VERSION = 1;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('documents', { keyPath: 'id' });
          // No keyPath: `meta` is a key/value bag, not a record store.
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveDocument(doc) {
  const db = await getDB();
  // updatedAt is stamped here rather than by callers so that every write path —
  // autosave, rename, reorder, duplicate — agrees on what "last touched" means.
  return db.put('documents', { ...doc, updatedAt: Date.now() });
}

export async function loadDocument(id) {
  const db = await getDB();
  return db.get('documents', id);
}

export async function loadAllDocuments() {
  const db = await getDB();
  return db.getAll('documents');
}

export async function deleteDocument(id) {
  const db = await getDB();
  return db.delete('documents', id);
}

export const META_KEY = 'app';

export async function saveMeta(meta) {
  const db = await getDB();
  return db.put('meta', meta, META_KEY);
}

export async function loadMeta() {
  const db = await getDB();
  const stored = await db.get('meta', META_KEY);
  return stored ?? { activeDocumentId: null, documentOrder: [] };
}

/**
 * Empties both stores in one transaction, so a failure part-way cannot leave
 * `meta` pointing at documents that no longer exist.
 */
export async function clearAll() {
  const db = await getDB();
  const tx = db.transaction(['documents', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('documents').clear(),
    tx.objectStore('meta').clear(),
  ]);
  await tx.done;
}

/**
 * Test-only. Drops the cached connection so a suite can swap the IndexedDB
 * implementation or start from a fresh database between cases.
 */
export function __resetDbForTests() {
  dbPromise = null;
}
