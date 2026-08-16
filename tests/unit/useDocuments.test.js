import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useDocuments, {
  AUTOSAVE_DEBOUNCE_MS,
  UNTITLED,
  deriveDocumentTitle,
} from '@/App/Container/Hooks/useDocuments.js';
import { initialText } from '@/App/Container/Hooks/InitialText.js';
import {
  clearAll,
  loadAllDocuments,
  loadDocument,
  loadMeta,
  saveDocument,
  saveMeta,
} from '@/App/Lib/db.js';
import {
  __registeredResetNames,
  __resetRegistryForTests,
} from '@/App/Lib/resetAll.js';

beforeEach(async () => {
  await clearAll();
  __resetRegistryForTests();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const mount = async () => {
  const rendered = renderHook(() => useDocuments());
  await waitFor(() => expect(rendered.result.current.ready).toBe(true));
  return rendered;
};

const api = (result) => result.current;

describe('deriveDocumentTitle', () => {
  it('uses the first ATX h1', () => {
    expect(deriveDocumentTitle('# Report\n\nbody\n')).toBe('Report');
  });

  it('uses a setext h1', () => {
    expect(deriveDocumentTitle('Report\n======\n\nbody')).toBe('Report');
  });

  it('ignores deeper headings', () => {
    expect(deriveDocumentTitle('## Section\n\ntext')).toBe(UNTITLED);
  });

  it('trims a closing run of hashes', () => {
    expect(deriveDocumentTitle('# Report #\n')).toBe('Report');
  });

  it('skips frontmatter', () => {
    // `# ` cannot appear in valid YAML at column 0, but the block must not be
    // searched at all — a comment inside it would otherwise win.
    expect(deriveDocumentTitle('---\ntitle: X\n---\n\n# Real Title\n')).toBe(
      'Real Title',
    );
  });

  it('skips fenced code, so a shell comment cannot name the tab', () => {
    const body = '```bash\n# install deps\npnpm i\n```\n\n# Actual Title\n';
    expect(deriveDocumentTitle(body)).toBe('Actual Title');
  });

  it('handles tilde fences too', () => {
    expect(deriveDocumentTitle('~~~\n# not this\n~~~\n\n# This\n')).toBe(
      'This',
    );
  });

  it('falls back to Untitled', () => {
    for (const body of ['', '   ', 'just a paragraph', null, undefined]) {
      expect(deriveDocumentTitle(body)).toBe(UNTITLED);
    }
  });
});

describe('migration', () => {
  it('creates one document from InitialText when the store is empty', async () => {
    const { result } = await mount();
    expect(api(result).documents).toHaveLength(1);
    expect(api(result).activeDocument.body).toBe(initialText);
    expect(api(result).activeId).toBe(api(result).documents[0].id);
  });

  it('persists the migrated document and its meta', async () => {
    const { result } = await mount();
    const stored = await loadAllDocuments();
    expect(stored).toHaveLength(1);
    expect(await loadMeta()).toEqual({
      activeDocumentId: api(result).activeId,
      documentOrder: [api(result).activeId],
    });
  });

  it('is idempotent — a second mount finds the store populated', async () => {
    const first = await mount();
    const id = api(first.result).activeId;
    first.unmount();

    const second = await mount();
    expect(api(second.result).documents).toHaveLength(1);
    expect(api(second.result).activeId).toBe(id);
  });

  it('restores documents and active state from a populated store', async () => {
    await saveDocument({ id: 'a', title: 'A', body: '# A', createdAt: 1 });
    await saveDocument({ id: 'b', title: 'B', body: '# B', createdAt: 2 });
    await saveMeta({ activeDocumentId: 'b', documentOrder: ['b', 'a'] });

    const { result } = await mount();
    expect(api(result).documents.map((d) => d.id)).toEqual(['b', 'a']);
    expect(api(result).activeDocument.body).toBe('# B');
  });

  it('appends documents missing from the stored order rather than losing them', async () => {
    await saveDocument({ id: 'a', title: 'A', body: 'a', createdAt: 1 });
    await saveDocument({ id: 'orphan', title: 'O', body: 'o', createdAt: 2 });
    await saveMeta({ activeDocumentId: 'a', documentOrder: ['a'] });

    const { result } = await mount();
    expect(api(result).documents.map((d) => d.id)).toEqual(['a', 'orphan']);
  });

  it('falls back to the first document when the stored active id is stale', async () => {
    await saveDocument({ id: 'a', title: 'A', body: 'a', createdAt: 1 });
    await saveMeta({ activeDocumentId: 'deleted', documentOrder: ['a'] });

    const { result } = await mount();
    expect(api(result).activeId).toBe('a');
  });

  it('stays usable with an in-memory document when IndexedDB is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const real = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    // The cached connection is dropped by clearAll's failure path, so force a
    // fresh module state via a direct import cycle is unnecessary here: the
    // bootstrap opens its own connection.
    const { __resetDbForTests } = await import('@/App/Lib/db.js');
    __resetDbForTests();

    try {
      const { result } = await mount();
      expect(api(result).documents).toHaveLength(1);
      expect(api(result).activeDocument.body).toBe(initialText);
      expect(api(result).status).toBe('error');
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        value: real,
        configurable: true,
        writable: true,
      });
      __resetDbForTests();
    }
  });
});

describe('autosave', () => {
  it('does not write within the debounce window, and does after it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = await mount();
    const id = api(result).activeId;

    await act(async () => api(result).updateActiveBody('# Edited'));
    expect(api(result).status).toBe('saving');

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 50);
    });
    expect((await loadDocument(id)).body).toBe(initialText);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await waitFor(async () =>
      expect((await loadDocument(id)).body).toBe('# Edited'),
    );
  });

  it('coalesces a burst of keystrokes into one write', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = await mount();
    const id = api(result).activeId;

    for (const body of ['a', 'ab', 'abc', 'abcd']) {
      await act(async () => api(result).updateActiveBody(body));
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
    }
    // 800ms of typing: still nothing written.
    expect((await loadDocument(id)).body).toBe(initialText);

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    await waitFor(async () =>
      expect((await loadDocument(id)).body).toBe('abcd'),
    );
  });

  it('reports saving while the write is pending and saved once it lands', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = await mount();
    await act(async () => api(result).updateActiveBody('# X'));
    expect(api(result).status).toBe('saving');

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    await waitFor(() => expect(api(result).status).toBe('saved'));
  });

  it('flush writes immediately', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = await mount();
    const id = api(result).activeId;

    await act(async () => api(result).updateActiveBody('# Flushed'));
    await act(async () => {
      await api(result).flush();
    });
    expect((await loadDocument(id)).body).toBe('# Flushed');
  });

  it('flush with nothing pending is harmless', async () => {
    const { result } = await mount();
    await act(async () => {
      await expect(api(result).flush()).resolves.toBeUndefined();
    });
  });

  it('re-derives the title as the body changes', async () => {
    const { result } = await mount();
    await act(async () => api(result).updateActiveBody('# New Name\n\ntext'));
    expect(api(result).activeDocument.title).toBe('New Name');

    await act(async () => api(result).updateActiveBody('no heading now'));
    expect(api(result).activeDocument.title).toBe(UNTITLED);
  });

  it('surfaces a failed write instead of pretending it saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await mount();
    const real = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const { __resetDbForTests } = await import('@/App/Lib/db.js');
    __resetDbForTests();

    try {
      await act(async () => api(result).updateActiveBody('# Doomed'));
      await act(async () => {
        await api(result).flush();
      });
      expect(api(result).status).toBe('error');
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        value: real,
        configurable: true,
        writable: true,
      });
      __resetDbForTests();
    }
  });

  it('flushes when the page is hidden', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = await mount();
    const id = api(result).activeId;
    await act(async () => api(result).updateActiveBody('# Hidden'));

    await act(async () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(async () =>
      expect((await loadDocument(id)).body).toBe('# Hidden'),
    );
  });

  it('does not flush when the page merely becomes visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = await mount();
    const id = api(result).activeId;
    await act(async () => api(result).updateActiveBody('# Visible'));

    await act(async () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect((await loadDocument(id)).body).toBe(initialText);
  });

  it('flushes on beforeunload without cancelling the navigation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = await mount();
    const id = api(result).activeId;
    await act(async () => api(result).updateActiveBody('# Leaving'));

    const event = new Event('beforeunload', { cancelable: true });
    await act(async () => {
      window.dispatchEvent(event);
    });
    // The nag is gone: the listener saves, it does not prompt.
    expect(event.defaultPrevented).toBe(false);
    expect(event.returnValue).not.toBe(false);
    await waitFor(async () =>
      expect((await loadDocument(id)).body).toBe('# Leaving'),
    );
  });
});

describe('document actions', () => {
  it('create adds a document without activating it', async () => {
    const { result } = await mount();
    const before = api(result).activeId;

    let id;
    await act(async () => {
      id = api(result).create();
    });
    expect(api(result).documents).toHaveLength(2);
    expect(api(result).activeId).toBe(before);
    await waitFor(async () => expect(await loadDocument(id)).toBeTruthy());
  });

  it('create accepts an explicit title and defaults to Untitled', async () => {
    const { result } = await mount();
    await act(async () => api(result).create('Notes'));
    await act(async () => api(result).create());
    const titles = api(result).documents.map((d) => d.title);
    expect(titles).toContain('Notes');
    expect(titles).toContain(UNTITLED);
  });

  it('open changes the active document and persists it', async () => {
    const { result } = await mount();
    let id;
    await act(async () => {
      id = api(result).create();
    });
    await act(async () => {
      await api(result).open(id);
    });
    expect(api(result).activeId).toBe(id);
    await waitFor(async () =>
      expect((await loadMeta()).activeDocumentId).toBe(id),
    );
  });

  it('open flushes the outgoing document first', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = await mount();
    const first = api(result).activeId;
    let second;
    await act(async () => {
      second = api(result).create();
    });

    // No debounce wait: the switch itself must be what saves it.
    await act(async () => api(result).updateActiveBody('# Unsaved yet'));
    await act(async () => {
      await api(result).open(second);
    });
    expect((await loadDocument(first)).body).toBe('# Unsaved yet');
  });

  it('open ignores an unknown id and a no-op switch', async () => {
    const { result } = await mount();
    const id = api(result).activeId;
    await act(async () => {
      await api(result).open('nope');
      await api(result).open(id);
    });
    expect(api(result).activeId).toBe(id);
  });

  it('rename updates the title and persists it', async () => {
    const { result } = await mount();
    const id = api(result).activeId;
    await act(async () => api(result).rename(id, '  Renamed  '));
    expect(api(result).activeDocument.title).toBe('Renamed');
    await waitFor(async () =>
      expect((await loadDocument(id)).title).toBe('Renamed'),
    );
  });

  it('rename falls back to Untitled on an empty title', async () => {
    const { result } = await mount();
    await act(async () => api(result).rename(api(result).activeId, '   '));
    expect(api(result).activeDocument.title).toBe(UNTITLED);
  });

  it('duplicate copies the body, suffixes the title, and sits next to the original', async () => {
    const { result } = await mount();
    await act(async () => api(result).rename(api(result).activeId, 'Source'));
    await act(async () => api(result).create('Trailing'));

    let copyId;
    await act(async () => {
      copyId = api(result).duplicate(api(result).documents[0].id);
    });

    const docs = api(result).documents;
    expect(docs.map((d) => d.title)).toEqual([
      'Source',
      'Source (copy)',
      'Trailing',
    ]);
    expect(docs[1].body).toBe(initialText);
    expect(docs[1].id).not.toBe(docs[0].id);
    expect(docs[1].id).toBe(copyId);
    await waitFor(async () => expect(await loadDocument(copyId)).toBeTruthy());
  });

  it('remove deletes from the store and from the strip', async () => {
    const { result } = await mount();
    let id;
    await act(async () => {
      id = api(result).create();
    });
    await waitFor(async () => expect(await loadAllDocuments()).toHaveLength(2));

    await act(async () => api(result).remove(id));
    expect(api(result).documents).toHaveLength(1);
    await waitFor(async () => expect(await loadDocument(id)).toBeUndefined());
  });

  it('removing the active document activates its right-hand neighbour', async () => {
    const { result } = await mount();
    await act(async () => api(result).create('B'));
    await act(async () => api(result).create('C'));
    const [a, b, c] = api(result).documents.map((d) => d.id);

    await act(async () => {
      await api(result).open(b);
    });
    await act(async () => api(result).remove(b));
    expect(api(result).activeId).toBe(c);
    expect(api(result).documents.map((d) => d.id)).toEqual([a, c]);
  });

  it('removing the last document in the strip falls back to the left', async () => {
    const { result } = await mount();
    await act(async () => api(result).create('B'));
    const [a, b] = api(result).documents.map((d) => d.id);

    await act(async () => {
      await api(result).open(b);
    });
    await act(async () => api(result).remove(b));
    expect(api(result).activeId).toBe(a);
  });

  it('removing the only document leaves a fresh empty one, never zero', async () => {
    const { result } = await mount();
    const id = api(result).activeId;
    await act(async () => api(result).remove(id));

    expect(api(result).documents).toHaveLength(1);
    expect(api(result).documents[0].id).not.toBe(id);
    expect(api(result).activeDocument.body).toBe('');
  });

  it('removing a document cancels its pending save', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = await mount();
    await act(async () => api(result).create('B'));
    const id = api(result).activeId;

    await act(async () => api(result).updateActiveBody('# doomed'));
    await act(async () => api(result).remove(id));
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    });
    // The debounced write must not resurrect a deleted record.
    expect(await loadDocument(id)).toBeUndefined();
  });

  it('reorder persists the new order', async () => {
    const { result } = await mount();
    await act(async () => api(result).create('B'));
    await act(async () => api(result).create('C'));
    const [a, b, c] = api(result).documents.map((d) => d.id);

    await act(async () => api(result).reorder([c, a, b]));
    expect(api(result).documents.map((d) => d.id)).toEqual([c, a, b]);
    await waitFor(async () =>
      expect((await loadMeta()).documentOrder).toEqual([c, a, b]),
    );
  });

  it('reorder rejects an order that would drop a document', async () => {
    const { result } = await mount();
    await act(async () => api(result).create('B'));
    const before = api(result).documents.map((d) => d.id);

    await act(async () => api(result).reorder([before[0]]));
    expect(api(result).documents.map((d) => d.id)).toEqual(before);
  });

  it('survives a reload with order and active state intact', async () => {
    const first = await mount();
    await act(async () => api(first.result).create('B'));
    await act(async () => api(first.result).create('C'));
    const ids = api(first.result).documents.map((d) => d.id);
    await act(async () => api(first.result).reorder([ids[2], ids[0], ids[1]]));
    await act(async () => {
      await api(first.result).open(ids[2]);
    });
    first.unmount();

    const second = await mount();
    expect(api(second.result).documents.map((d) => d.id)).toEqual([
      ids[2],
      ids[0],
      ids[1],
    ]);
    expect(api(second.result).activeId).toBe(ids[2]);
  });
});

describe('reset', () => {
  it('registers with the central registry', async () => {
    const { unmount } = await mount();
    expect(__registeredResetNames()).toContain('documents');
    unmount();
    expect(__registeredResetNames()).not.toContain('documents');
  });

  it('empties local state', async () => {
    const { result } = await mount();
    await act(async () => api(result).reset());
    expect(api(result).documents).toEqual([]);
    expect(api(result).activeId).toBeNull();
    expect(api(result).activeDocument).toBeNull();
    expect(api(result).text).toBe('');
  });
});
