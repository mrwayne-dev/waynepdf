import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, toOverrides } from '@/App/Lib/parseFrontmatter.js';
import {
  getOverrides,
  setOverrides,
  clearOverrides,
  subscribeOverrides,
} from '@/App/Lib/frontmatterOverrides.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (name) =>
  fs.readFileSync(path.resolve(__dirname, '../fixtures', name), 'utf8');

describe('parseFrontmatter', () => {
  it('splits a valid block from the body', () => {
    const { frontmatter, body, error } = parseFrontmatter(
      read('frontmatter.md'),
    );
    expect(error).toBeNull();
    expect(frontmatter.title).toBe('Frontmatter Fixture');
    expect(frontmatter.theme).toBe('sepia');
    expect(body.trimStart().startsWith('# Frontmatter Fixture')).toBe(true);
    // The YAML must be gone from what gets rendered.
    expect(body).not.toContain('pageSize');
  });

  it('preserves YAML types rather than stringifying them', () => {
    const { frontmatter } = parseFrontmatter(
      '---\nn: 5\nflag: true\ns: text\n---\n\nbody\n',
    );
    expect(frontmatter.n).toBe(5);
    expect(frontmatter.flag).toBe(true);
    expect(frontmatter.s).toBe('text');
  });

  it('reports an error and leaves the body untouched on malformed YAML', () => {
    const source = read('frontmatter-malformed.md');
    const { frontmatter, body, error } = parseFrontmatter(source);
    expect(error).toBeTruthy();
    expect(frontmatter).toEqual({});
    // The block stays visible so the user can see the YAML they need to fix.
    expect(body).toBe(source);
  });

  it.each([
    ['empty document', ''],
    ['no frontmatter', '# Just a heading\n'],
    ['delimiter-lookalike mid-document', 'text\n\n---\n\nmore text\n'],
  ])('handles %s', (_label, source) => {
    const { frontmatter, body, error } = parseFrontmatter(source);
    expect(error).toBeNull();
    expect(frontmatter).toEqual({});
    expect(body).toBe(source);
  });

  it('handles a document that is only frontmatter', () => {
    const { frontmatter, body } = parseFrontmatter('---\ntitle: X\n---\n');
    expect(frontmatter.title).toBe('X');
    expect(body.trim()).toBe('');
  });

  it('handles non-string input without throwing', () => {
    for (const input of [null, undefined, 42, {}]) {
      expect(() => parseFrontmatter(input)).not.toThrow();
      expect(parseFrontmatter(input).body).toBe('');
    }
  });
});

describe('toOverrides', () => {
  it('returns nothing for an empty or absent block', () => {
    expect(toOverrides({})).toEqual({});
    expect(toOverrides(undefined)).toEqual({});
    expect(toOverrides(null)).toEqual({});
  });

  it('ignores unrecognised keys silently', () => {
    expect(toOverrides({ nonsense: 1, alsoNonsense: 'x' })).toEqual({});
  });

  it.each([
    ['light'],
    ['dark'],
    ['sepia'],
    ['high-contrast'],
    ['print-optimized'],
    ['system'],
  ])('accepts theme %s', (theme) => {
    expect(toOverrides({ theme }).theme).toBe(theme);
  });

  it('rejects an unknown theme rather than erroring', () => {
    expect(toOverrides({ theme: 'neon' }).theme).toBeUndefined();
  });

  it('accepts page size and orientation, case-insensitively', () => {
    expect(toOverrides({ pageSize: 'A5' }).pageSize).toBe('a5');
    expect(toOverrides({ orientation: 'Landscape' }).orientation).toBe(
      'landscape',
    );
  });

  it('rejects an unknown page size', () => {
    expect(toOverrides({ pageSize: 'a9' }).pageSize).toBeUndefined();
  });

  it('accepts a margin preset name', () => {
    expect(toOverrides({ margin: 'wide' }).marginPreset).toBe('wide');
  });

  it('accepts a numeric margin as millimetres on all sides', () => {
    const out = toOverrides({ margin: 12 });
    expect(out.marginPreset).toBe('custom');
    expect(out.marginTop).toBe(12);
    expect(out.marginLeft).toBe(12);
  });

  it('accepts toc as a boolean or an object', () => {
    expect(toOverrides({ toc: true }).toc).toEqual({ enabled: true });
    expect(toOverrides({ toc: false }).toc).toEqual({ enabled: false });
    expect(toOverrides({ toc: { depth: 3 } }).toc).toEqual({
      enabled: true,
      depth: 3,
    });
  });

  it('drops an out-of-range toc depth but keeps the enable', () => {
    expect(toOverrides({ toc: { depth: 9 } }).toc).toEqual({ enabled: true });
  });

  it('accepts watermark as a string or an object', () => {
    expect(toOverrides({ watermark: 'DRAFT' }).watermark).toEqual({
      text: 'DRAFT',
    });
    expect(
      toOverrides({ watermark: { text: 'X', opacity: 0.3 } }).watermark,
    ).toEqual({ text: 'X', opacity: 0.3 });
  });

  it('drops an out-of-range watermark opacity', () => {
    expect(
      toOverrides({ watermark: { text: 'X', opacity: 5 } }).watermark,
    ).toEqual({ text: 'X' });
  });

  it('maps cover fields and enables the cover, since otherwise they are inert', () => {
    const out = toOverrides({ title: 'T', author: 'A' });
    expect(out.cover).toEqual({ title: 'T', author: 'A', enabled: true });
  });

  it('lets an explicit cover: false win over implied enabling', () => {
    expect(toOverrides({ title: 'T', cover: false }).cover.enabled).toBe(false);
  });

  it('accepts a nested cover object', () => {
    const out = toOverrides({ cover: { title: 'T', subtitle: 'S' } });
    expect(out.cover).toMatchObject({
      title: 'T',
      subtitle: 'S',
      enabled: true,
    });
  });

  it('coerces a YAML date to a string', () => {
    // gray-matter parses unquoted dates into Date objects.
    expect(
      typeof toOverrides({ date: new Date('2026-08-16') }).cover.date,
    ).toBe('string');
  });

  it('maps lang and dir onto the language container shape', () => {
    expect(toOverrides({ lang: 'ja' }).lang).toBe('ja');
    expect(toOverrides({ dir: 'RTL' }).direction).toBe('rtl');
    expect(toOverrides({ dir: 'sideways' }).direction).toBeUndefined();
  });

  it('maps the whole fixture end to end', () => {
    const { frontmatter } = parseFrontmatter(read('frontmatter.md'));
    const out = toOverrides(frontmatter);
    expect(out).toMatchObject({
      theme: 'sepia',
      pageSize: 'a5',
      lang: 'en',
      toc: { enabled: true },
      watermark: { text: 'SPECIMEN' },
    });
    expect(out.cover).toMatchObject({
      title: 'Frontmatter Fixture',
      author: 'M. Mgbah',
      enabled: true,
    });
  });
});

describe('override store', () => {
  it('starts empty and round-trips a value', () => {
    clearOverrides();
    expect(getOverrides()).toEqual({});
    setOverrides({ theme: 'dark' });
    expect(getOverrides()).toEqual({ theme: 'dark' });
    clearOverrides();
    expect(getOverrides()).toEqual({});
  });

  it('notifies subscribers on change', () => {
    clearOverrides();
    const seen = [];
    const unsub = subscribeOverrides((v) => seen.push(v));
    setOverrides({ theme: 'sepia' });
    setOverrides({});
    unsub();
    setOverrides({ theme: 'dark' });
    expect(seen).toEqual([{ theme: 'sepia' }, {}]);
  });

  it('does not notify when the value is unchanged', () => {
    clearOverrides();
    let calls = 0;
    const unsub = subscribeOverrides(() => {
      calls += 1;
    });
    setOverrides({ theme: 'dark' });
    // Same content, different object identity — must not re-notify, or every
    // keystroke would re-render three containers.
    setOverrides({ theme: 'dark' });
    unsub();
    expect(calls).toBe(1);
  });

  it('coerces a non-object to empty', () => {
    clearOverrides();
    setOverrides('nope');
    expect(getOverrides()).toEqual({});
  });
});
