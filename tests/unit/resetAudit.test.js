import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORAGE_PREFIX } from '@/App/Lib/resetAll.js';

const SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src',
);

/** Every source file, so a new container cannot hide from this. */
function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

/**
 * Reset is complete by construction, not by enumeration.
 *
 * resetAll sweeps every localStorage key beginning with `waynepdf.` rather than
 * listing the ones it knows about — which is what stopped language settings and
 * the frontmatter overrides being forgotten a second time. The sweep only holds
 * if every key the app writes actually carries the prefix, so that is the thing
 * worth pinning: a key named `wp.theme` or `settings.v2` would persist through
 * a Reset that reported success.
 */
describe('reset audit', () => {
  const files = sourceFiles(SRC);

  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('every localStorage key the app writes carries the reset prefix', () => {
    const offenders = [];

    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      // setItem/getItem/removeItem with a string literal key.
      const calls = text.matchAll(
        /localStorage\.(?:set|get|remove)Item\(\s*['"`]([^'"`]+)['"`]/g,
      );
      for (const [, key] of calls) {
        if (!key.startsWith(STORAGE_PREFIX)) {
          offenders.push(`${path.relative(SRC, file)}: ${key}`);
        }
      }

      /*
       * Keys declared as constants and passed through, the usual shape here —
       * but only in files that touch localStorage at all. Without that guard
       * this flagged db.js's META_KEY, which is a key *inside* an IndexedDB
       * object store and is cleared wholesale by clearAll() rather than by the
       * prefix sweep.
       *
       * A call, not a mention: db.js explains in a comment why localStorage is
       * the wrong home for documents, and a substring check took that as proof
       * it uses one.
       */
      if (!/localStorage\.(?:set|get|remove)Item/.test(text)) continue;
      const constants = text.matchAll(
        /(?:STORAGE_KEY|_KEY)\s*=\s*['"`]([^'"`]+)['"`]/g,
      );
      for (const [, key] of constants) {
        if (!key.startsWith(STORAGE_PREFIX)) {
          offenders.push(`${path.relative(SRC, file)}: ${key}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('the keys in use are the ones expected', () => {
    // A change here is fine — it just has to be deliberate.
    const keys = new Set();
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const [, key] of text.matchAll(/['"`](waynepdf\.[^'"`]+)['"`]/g)) {
        keys.add(key);
      }
    }
    expect([...keys].sort()).toEqual([
      'waynepdf.customThemes.v1',
      'waynepdf.exportFormat.v1',
      'waynepdf.language.v1',
      'waynepdf.layout.v1',
      'waynepdf.settings.v1',
    ]);
  });
});
