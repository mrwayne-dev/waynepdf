import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  registerReset,
  unregisterReset,
  resetAll,
  STORAGE_PREFIX,
  __registeredResetNames,
  __resetRegistryForTests,
} from '@/App/Lib/resetAll.js';
import {
  loadAllDocuments,
  saveDocument,
  saveMeta,
  __resetDbForTests,
} from '@/App/Lib/db.js';

/** resetAll always reloads; jsdom refuses to let location.reload be stubbed. */
const reload = () => vi.fn();

beforeEach(() => {
  __resetRegistryForTests();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reset registry', () => {
  it('accumulates resetters and dispatches every one', async () => {
    const calls = [];
    registerReset('a', () => calls.push('a'));
    registerReset('b', () => calls.push('b'));
    registerReset('c', () => calls.push('c'));

    await resetAll({ skipConfirm: true, reload: reload() });
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('replaces rather than duplicates a re-registration under the same name', async () => {
    const first = vi.fn();
    const second = vi.fn();
    registerReset('theme', first);
    registerReset('theme', second);

    expect(__registeredResetNames()).toEqual(['theme']);
    await resetAll({ skipConfirm: true, reload: reload() });
    // StrictMode double-invokes mount effects; without keying by name every
    // development reload would fire the resetter twice.
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('unregisters', async () => {
    const fn = vi.fn();
    registerReset('gone', fn);
    unregisterReset('gone');
    await resetAll({ skipConfirm: true, reload: reload() });
    expect(fn).not.toHaveBeenCalled();
  });

  it('awaits an async resetter before reloading', async () => {
    const order = [];
    registerReset('slow', async () => {
      await Promise.resolve();
      order.push('resetter');
    });
    const spy = vi.fn(() => order.push('reload'));

    await resetAll({ skipConfirm: true, reload: spy });
    expect(order).toEqual(['resetter', 'reload']);
  });

  it('keeps going when a resetter throws', async () => {
    const after = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registerReset('broken', () => {
      throw new Error('nope');
    });
    registerReset('after', after);

    const spy = reload();
    await expect(resetAll({ skipConfirm: true, reload: spy })).resolves.toBe(
      true,
    );
    expect(after).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('resetAll storage clearing', () => {
  it('removes every waynepdf-prefixed localStorage key', async () => {
    window.localStorage.setItem('waynepdf.settings.v1', '{"theme":"dark"}');
    window.localStorage.setItem('waynepdf.language.v1', '{"lang":"ja"}');
    window.localStorage.setItem('waynepdf.layout.v1', '{"pageSize":"a5"}');

    await resetAll({ skipConfirm: true, reload: reload() });
    expect(
      Object.keys(window.localStorage).filter((k) =>
        k.startsWith(STORAGE_PREFIX),
      ),
    ).toEqual([]);
  });

  it('leaves keys belonging to anything else on the origin alone', async () => {
    window.localStorage.setItem('waynepdf.settings.v1', '{}');
    window.localStorage.setItem('someOtherApp.state', 'keep me');

    await resetAll({ skipConfirm: true, reload: reload() });
    expect(window.localStorage.getItem('someOtherApp.state')).toBe('keep me');
  });

  it('empties the IndexedDB documents store', async () => {
    await saveDocument({ id: 'doc-1', title: 'T', body: '# T' });
    await saveMeta({ activeDocumentId: 'doc-1', documentOrder: ['doc-1'] });
    expect(await loadAllDocuments()).toHaveLength(1);

    await resetAll({ skipConfirm: true, reload: reload() });
    expect(await loadAllDocuments()).toEqual([]);
  });

  it('still reloads when clearing IndexedDB fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const spy = reload();
    /*
     * A blocked database — private-mode Firefox, a corrupt store, a storage
     * policy — must not leave the user with no way out of a broken state. The
     * cached connection has to be dropped first or getDB hands back the healthy
     * one it already resolved.
     */
    const real = globalThis.indexedDB;
    __resetDbForTests();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      await expect(resetAll({ skipConfirm: true, reload: spy })).resolves.toBe(
        true,
      );
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        value: real,
        configurable: true,
        writable: true,
      });
      __resetDbForTests();
    }
  });

  it('does not throw when localStorage access is blocked', async () => {
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    window.localStorage.setItem?.('waynepdf.settings.v1', '{}');
    await expect(
      resetAll({ skipConfirm: true, reload: reload() }),
    ).resolves.toBe(true);
  });
});

describe('resetAll confirmation', () => {
  it('asks before doing anything', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await resetAll({ reload: reload() });
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('skipConfirm bypasses the prompt', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await resetAll({ skipConfirm: true, reload: reload() });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('cancelling clears nothing, calls nothing, and returns false', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    window.localStorage.setItem('waynepdf.settings.v1', '{"theme":"dark"}');
    await saveDocument({ id: 'keep', title: 'K', body: 'k' });
    const fn = vi.fn();
    registerReset('theme', fn);
    const spy = reload();

    await expect(resetAll({ reload: spy })).resolves.toBe(false);
    expect(window.localStorage.getItem('waynepdf.settings.v1')).toBe(
      '{"theme":"dark"}',
    );
    expect(await loadAllDocuments()).toHaveLength(1);
    expect(fn).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });
});
