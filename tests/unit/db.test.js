import { describe, it, expect, beforeEach } from 'vitest';
// A real IndexedDB implementation in memory. jsdom ships none, and mocking the
// wrapper instead would test the mock rather than the schema.
import 'fake-indexeddb/auto';
import {
  DB_NAME,
  DB_VERSION,
  getDB,
  saveDocument,
  loadDocument,
  loadAllDocuments,
  deleteDocument,
  saveMeta,
  loadMeta,
  clearAll,
} from '@/App/Lib/db.js';

const doc = (id, over = {}) => ({
  id,
  title: `Doc ${id}`,
  body: `# Doc ${id}`,
  createdAt: 1000,
  ...over,
});

beforeEach(async () => {
  await clearAll();
});

describe('schema', () => {
  it('creates both stores on first open', async () => {
    const db = await getDB();
    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['documents', 'meta']);
  });

  it('keys documents on id and meta out of line', async () => {
    const db = await getDB();
    expect(db.transaction('documents').store.keyPath).toBe('id');
    // A key/value bag: the key is passed at write time, not read off the value.
    expect(db.transaction('meta').store.keyPath).toBeNull();
  });

  it('reuses one connection across calls', async () => {
    expect(await getDB()).toBe(await getDB());
  });
});

describe('documents store', () => {
  it('round-trips a record', async () => {
    await saveDocument(doc('a'));
    const loaded = await loadDocument('a');
    expect(loaded).toMatchObject({ id: 'a', title: 'Doc a', body: '# Doc a' });
  });

  it('stamps updatedAt on every write', async () => {
    await saveDocument(doc('a'));
    const first = (await loadDocument('a')).updatedAt;
    expect(typeof first).toBe('number');

    await saveDocument({ ...doc('a'), body: 'changed' });
    const second = await loadDocument('a');
    expect(second.body).toBe('changed');
    expect(second.updatedAt).toBeGreaterThanOrEqual(first);
  });

  it('preserves createdAt across updates', async () => {
    await saveDocument(doc('a', { createdAt: 42 }));
    await saveDocument({ ...(await loadDocument('a')), body: 'v2' });
    expect((await loadDocument('a')).createdAt).toBe(42);
  });

  it('overwrites rather than duplicates on the same id', async () => {
    await saveDocument(doc('a'));
    await saveDocument(doc('a', { title: 'Renamed' }));
    expect(await loadAllDocuments()).toHaveLength(1);
    expect((await loadDocument('a')).title).toBe('Renamed');
  });

  it('returns undefined for a missing id rather than throwing', async () => {
    expect(await loadDocument('nope')).toBeUndefined();
  });

  it('lists every document', async () => {
    await saveDocument(doc('a'));
    await saveDocument(doc('b'));
    await saveDocument(doc('c'));
    expect((await loadAllDocuments()).map((d) => d.id).sort()).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('deletes', async () => {
    await saveDocument(doc('a'));
    await saveDocument(doc('b'));
    await deleteDocument('a');
    expect(await loadDocument('a')).toBeUndefined();
    expect(await loadAllDocuments()).toHaveLength(1);
  });

  it('deleting a missing id is a no-op', async () => {
    await expect(deleteDocument('nope')).resolves.not.toThrow();
  });

  it('stores a body large enough to break localStorage', async () => {
    // ~2 MB. The whole reason documents left localStorage, whose origin-wide
    // budget is around 5 MB of UTF-16.
    const body = 'x'.repeat(2 * 1024 * 1024);
    await saveDocument(doc('big', { body }));
    expect((await loadDocument('big')).body).toHaveLength(body.length);
  });
});

describe('meta store', () => {
  it('defaults when nothing has been written', async () => {
    expect(await loadMeta()).toEqual({
      activeDocumentId: null,
      documentOrder: [],
    });
  });

  it('round-trips', async () => {
    await saveMeta({ activeDocumentId: 'b', documentOrder: ['a', 'b'] });
    expect(await loadMeta()).toEqual({
      activeDocumentId: 'b',
      documentOrder: ['a', 'b'],
    });
  });

  it('replaces on each write, keeping exactly one entry', async () => {
    await saveMeta({ activeDocumentId: 'a', documentOrder: ['a'] });
    await saveMeta({ activeDocumentId: 'b', documentOrder: ['b'] });
    const db = await getDB();
    expect(await db.count('meta')).toBe(1);
    expect((await loadMeta()).activeDocumentId).toBe('b');
  });
});

describe('clearAll', () => {
  it('empties both stores', async () => {
    await saveDocument(doc('a'));
    await saveDocument(doc('b'));
    await saveMeta({ activeDocumentId: 'a', documentOrder: ['a', 'b'] });

    await clearAll();
    expect(await loadAllDocuments()).toEqual([]);
    expect(await loadMeta()).toEqual({
      activeDocumentId: null,
      documentOrder: [],
    });
  });

  it('is idempotent', async () => {
    await clearAll();
    await expect(clearAll()).resolves.not.toThrow();
  });

  it('leaves the database usable afterwards', async () => {
    await saveDocument(doc('a'));
    await clearAll();
    await saveDocument(doc('c'));
    expect(await loadAllDocuments()).toHaveLength(1);
  });
});

describe('concurrency', () => {
  it('does not lose writes issued in parallel', async () => {
    await Promise.all(
      Array.from({ length: 25 }, (_, i) => saveDocument(doc(`p${i}`))),
    );
    expect(await loadAllDocuments()).toHaveLength(25);
  });

  it('serialises repeated writes to the same id to a consistent last value', async () => {
    // Autosave can fire again before the previous put settles; IndexedDB orders
    // transactions, so the store must end up holding one of the written values
    // and not a torn record.
    await Promise.all(
      ['v1', 'v2', 'v3', 'v4'].map((body) => saveDocument(doc('a', { body }))),
    );
    const loaded = await loadDocument('a');
    expect(['v1', 'v2', 'v3', 'v4']).toContain(loaded.body);
    expect(await loadAllDocuments()).toHaveLength(1);
  });

  it('reads issued during a write still resolve', async () => {
    const write = saveDocument(doc('a', { body: 'written' }));
    const read = loadDocument('a');
    await Promise.all([write, read]);
    expect((await loadDocument('a')).body).toBe('written');
  });
});
