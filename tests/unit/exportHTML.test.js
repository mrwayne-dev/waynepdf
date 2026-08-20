import { describe, it, expect } from 'vitest';
import {
  deriveExportTitle,
  assembleHTML,
  escapeHTML,
} from '@/App/Lib/exportHTML.js';
import { safeFilename } from '@/App/Lib/downloadBlob.js';

describe('escapeHTML', () => {
  it('escapes the five characters that break markup', () => {
    expect(escapeHTML('<a href="x">&\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('handles null and undefined without printing them', () => {
    expect(escapeHTML(null)).toBe('');
    expect(escapeHTML(undefined)).toBe('');
  });
});

describe('deriveExportTitle', () => {
  const layout = (over = {}) => ({ cover: { enabled: false }, ...over });

  it('prefers the cover title when the cover is on', () => {
    expect(
      deriveExportTitle({
        body: '# Heading Wins Otherwise',
        layout: layout({ cover: { enabled: true, title: 'Cover Title' } }),
      }),
    ).toBe('Cover Title');
  });

  it('ignores the cover title when the cover is off', () => {
    expect(
      deriveExportTitle({
        body: '# From The Heading',
        layout: layout({ cover: { enabled: false, title: 'Cover Title' } }),
      }),
    ).toBe('From The Heading');
  });

  it('falls back to the first h1', () => {
    expect(
      deriveExportTitle({ body: '# Just A Heading\n\nbody', layout: layout() }),
    ).toBe('Just A Heading');
  });

  it('skips frontmatter and fenced code when hunting the heading', () => {
    // Inherited from deriveDocumentTitle: a shell example opening with
    // `# install deps` must not name the exported file.
    const body =
      '---\ntitle: X\n---\n\n```bash\n# install deps\n```\n\n# Real Heading\n';
    expect(deriveExportTitle({ body, layout: layout() })).toBe('Real Heading');
  });

  it('falls back to Document, not Untitled', () => {
    // The tab strip says "Untitled"; a downloaded file reads better as
    // "Document", so the two fallbacks deliberately differ.
    expect(deriveExportTitle({ body: 'no heading', layout: layout() })).toBe(
      'Document',
    );
    expect(deriveExportTitle({ body: '', layout: layout() })).toBe('Document');
    expect(deriveExportTitle({})).toBe('Document');
  });
});

describe('assembleHTML', () => {
  const base = {
    renderedHTML: '<h1>Hi</h1>',
    inlinedCSS: 'body{color:red}',
    title: 'Doc',
    activeTheme: 'dark',
    lang: 'en',
    dir: 'ltr',
  };

  it('produces a complete document with the theme on <html>', () => {
    const html = assembleHTML(base);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<html lang="en" dir="ltr" data-theme="dark">');
    expect(html).toContain('<title>Doc</title>');
    expect(html).toContain('body{color:red}');
    expect(html).toContain('<div class="markdown-body">');
    expect(html).toContain('<h1>Hi</h1>');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('carries a custom theme id through unchanged', () => {
    const html = assembleHTML({ ...base, activeTheme: 'custom-abc-123' });
    expect(html).toContain('data-theme="custom-abc-123"');
  });

  it('omits lang when the detector could not tell', () => {
    // `und` is honest ignorance; asserting it would suppress the per-language
    // font stacks in the exported file for no gain.
    expect(assembleHTML({ ...base, lang: 'und' })).not.toContain('lang=');
  });

  it('escapes a hostile title instead of breaking out of the tag', () => {
    const html = assembleHTML({
      ...base,
      title: '</title><script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;/title&gt;');
  });

  it('escapes attribute values', () => {
    const html = assembleHTML({ ...base, lang: 'en" onload="x' });
    expect(html).not.toContain('onload="x"');
    expect(html).toContain('&quot;');
  });

  it('emits no external references at all', () => {
    /*
     * The invariant the whole exporter exists for. A link or script tag in the
     * template would mean the standalone file reaches the network.
     */
    const html = assembleHTML(base);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/https?:\/\//);
  });
});

describe('safeFilename', () => {
  it('keeps spaces and hyphens, which are legal and readable', () => {
    expect(safeFilename('Q3 Report - Final')).toBe('Q3 Report - Final');
  });

  it('strips path separators and Windows-reserved characters', () => {
    expect(safeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
  });

  it('never returns empty', () => {
    expect(safeFilename('')).toBe('Document');
    expect(safeFilename('   ')).toBe('Document');
    expect(safeFilename(null)).toBe('Document');
    expect(safeFilename('///')).toBe('Document');
  });

  it('drops a trailing dot, which Windows will not store', () => {
    expect(safeFilename('Report.')).toBe('Report');
  });

  it('bounds the length', () => {
    expect(safeFilename('x'.repeat(400))).toHaveLength(120);
  });
});
