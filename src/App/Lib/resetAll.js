import { clearAll } from './db.js';

/*
 * One Reset, everything cleared.
 *
 * WaynePDF's state is spread across four localStorage keys, an IndexedDB
 * database, and whatever the containers hold in memory. Before this, the
 * Settings Reset button called two of those by hand, which meant every new piece
 * of persistent state was one more thing somebody had to remember to add — and
 * language settings and the frontmatter override store had already been
 * forgotten.
 *
 * A registry inverts that: whoever owns persistent state registers its resetter,
 * and Reset is a single call that cannot fall behind.
 */

const resetters = new Map();

/**
 * Registers a reset function under a stable name.
 *
 * Keyed by name rather than appended, so a container that re-mounts (React
 * StrictMode double-invokes effects in development) replaces its entry instead
 * of accumulating duplicates.
 */
export function registerReset(name, fn) {
  resetters.set(name, fn);
}

export function unregisterReset(name) {
  resetters.delete(name);
}

/** Every WaynePDF-owned localStorage key shares this prefix. */
export const STORAGE_PREFIX = 'waynepdf.';

function clearLocalStorage() {
  let keys;
  try {
    // Snapshot the keys first: removeItem during iteration over a live
    // StorageObject would skip entries.
    keys = Object.keys(window.localStorage);
  } catch {
    return;
  }
  for (const key of keys) {
    if (!key.startsWith(STORAGE_PREFIX)) continue;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* blocked storage; nothing useful to do */
    }
  }
}

function reloadPage() {
  window.location.reload();
}

/**
 * Clears all persisted and in-memory state, then reloads.
 *
 * Order is deliberate: storage is emptied *before* the in-memory resetters run.
 * Those resetters set container state back to defaults, and each container
 * persists on change — so clearing last would race with defaults being written
 * back. Clearing first means the writes that follow are the ones we want.
 *
 * The reload is what actually returns the app to a first-run state; the
 * in-memory resetters cover the moment before it and the case where a caller
 * suppresses the reload.
 *
 * @param {object}   [options]
 * @param {boolean}  [options.skipConfirm] Bypass the confirmation prompt.
 * @param {Function} [options.reload]      Injectable for tests — jsdom refuses
 *                                         to let `location.reload` be redefined.
 * @returns {Promise<boolean>} false if the user cancelled.
 */
export async function resetAll({
  skipConfirm = false,
  reload = reloadPage,
} = {}) {
  if (!skipConfirm) {
    const ok = window.confirm(
      'This will delete all documents and reset all settings. Continue?',
    );
    if (!ok) return false;
  }

  clearLocalStorage();

  try {
    await clearAll();
  } catch (err) {
    // A blocked or corrupt IndexedDB must not prevent the rest of the reset —
    // that would leave a user with a broken database and no way out of it.
    console.error('Reset: clearing IndexedDB failed:', err);
  }

  for (const [name, fn] of resetters) {
    try {
      await fn();
    } catch (err) {
      // One bad resetter must not strand the others; the whole point is that
      // Reset always gets through.
      console.error(`Reset: resetter "${name}" failed:`, err);
    }
  }

  reload();
  return true;
}

/** Test-only view of the registry. */
export function __registeredResetNames() {
  return [...resetters.keys()];
}

/** Test-only. Lets a hook test invoke its reset the way resetAll would. */
export function __getRegisteredReset(name) {
  return resetters.get(name);
}

/** Test-only. Empties the registry so suites do not leak into each other. */
export function __resetRegistryForTests() {
  resetters.clear();
}
