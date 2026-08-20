import { describe, it, expect } from 'vitest';
import { buildPackage, REQUIRED_ENTRIES } from '@/App/Lib/docx/buildPackage.js';
import { renderCoreProps } from '@/App/Lib/docx/templates/coreProps.js';

/* IR → the zip. */

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const sample = [
  { type: 'heading', level: 1, runs: [{ text: 'Title' }] },
  { type: 'paragraph', runs: [{ text: 'Body', link: 'https://example.com' }] },
  { type: 'image', dataUri: PIXEL, alt: 'diagram' },
];

const build = (blocks = sample, meta = { title: 'T', author: 'A' }) =>
  buildPackage(blocks, meta);

const read = (zip, path) => zip.file(path).async('string');

describe('package contents', () => {
  it('contains every part a reader requires', async () => {
    const zip = build();
    for (const entry of REQUIRED_ENTRIES) {
      expect(zip.file(entry), `${entry} missing`).toBeTruthy();
    }
  });

  it('writes media for each image', async () => {
    const zip = build();
    expect(zip.file('word/media/image1.png')).toBeTruthy();
  });

  it('writes no media when there are no images', () => {
    const zip = build([{ type: 'paragraph', runs: [{ text: 'x' }] }]);
    expect(zip.file(/word\/media\//)).toHaveLength(0);
  });
});

describe('relationship integrity', () => {
  it('declares every relationship id the document references', async () => {
    /*
     * The invariant that matters most and fails most quietly: a document that
     * references an id the rels part does not declare still OPENS. Word just
     * drops the link or the picture, with nothing said.
     */
    const zip = build();
    const documentXml = await read(zip, 'word/document.xml');
    const relsXml = await read(zip, 'word/_rels/document.xml.rels');

    const used = new Set(
      [...documentXml.matchAll(/r:(?:id|embed)="([^"]+)"/g)].map((m) => m[1]),
    );
    const declared = new Set(
      [...relsXml.matchAll(/Id="([^"]+)"/g)].map((m) => m[1]),
    );

    expect(used.size).toBeGreaterThan(0);
    for (const id of used) {
      expect(declared.has(id), `${id} used but not declared`).toBe(true);
    }
  });

  it('points every image relationship at a part that exists', async () => {
    const zip = build();
    const relsXml = await read(zip, 'word/_rels/document.xml.rels');
    const targets = [...relsXml.matchAll(/Target="(media\/[^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(zip.file(`word/${target}`), `${target} missing`).toBeTruthy();
    }
  });

  it('marks hyperlinks external and images not', async () => {
    // An image with TargetMode="External" resolves outside the package and the
    // picture never appears.
    const relsXml = await read(build(), 'word/_rels/document.xml.rels');
    const hyperlink = /Type="[^"]*\/hyperlink"[^>]*TargetMode="External"/.test(
      relsXml,
    );
    const image = /Type="[^"]*\/image"[^>]*TargetMode/.test(relsXml);
    expect(hyperlink).toBe(true);
    expect(image).toBe(false);
  });
});

describe('metadata', () => {
  it('carries title and author', async () => {
    const zip = build(sample, { title: 'My Doc', author: 'Michael' });
    const core = await read(zip, 'docProps/core.xml');
    expect(core).toContain('<dc:title>My Doc</dc:title>');
    expect(core).toContain('<dc:creator>Michael</dc:creator>');
  });

  it('escapes hostile metadata', async () => {
    const core = renderCoreProps({
      title: '</dc:title><evil/>',
      author: 'a&b',
    });
    expect(core).not.toContain('<evil/>');
    expect(core).toContain('a&amp;b');
  });

  it('widens a bare frontmatter date into a dateTime', () => {
    // W3CDTF accepts a date, this element does not.
    expect(renderCoreProps({ title: 't', date: '2026-08-20' })).toContain(
      '2026-08-20T00:00:00Z',
    );
  });

  it('falls back to now rather than writing a malformed timestamp', () => {
    const core = renderCoreProps({ title: 't', date: 'not a date' });
    expect(core).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
  });

  it('tolerates a missing author', async () => {
    const core = await read(build(sample, { title: 'T' }), 'docProps/core.xml');
    expect(core).toContain('<dc:creator></dc:creator>');
  });
});

describe('declared content types', () => {
  it('types every part the package ships', async () => {
    const types = await read(build(), '[Content_Types].xml');
    for (const part of [
      '/word/document.xml',
      '/word/styles.xml',
      '/word/numbering.xml',
      '/docProps/core.xml',
    ]) {
      expect(types).toContain(`PartName="${part}"`);
    }
    // Images are typed by extension default rather than per-part override.
    expect(types).toContain('Extension="png"');
  });
});
