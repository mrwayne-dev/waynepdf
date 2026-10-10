import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateLayoutCSS,
  applyLayoutCSS,
  templateToContent,
  LAYOUT_STYLE_ID,
} from '@/App/Lib/generateLayoutCSS.js';
import { DEFAULTS, normalizeLayout } from '@/App/Container/Hooks/useLayout.js';

const layout = (over = {}) => normalizeLayout({ ...DEFAULTS, ...over });

describe('templateToContent', () => {
  it('returns null for an empty template so no margin box is emitted', () => {
    expect(templateToContent('')).toBeNull();
    expect(templateToContent(undefined)).toBeNull();
  });

  it('maps each placeholder to its CSS function', () => {
    expect(templateToContent('{page}')).toBe('counter(page)');
    expect(templateToContent('{pages}')).toBe('counter(pages)');
    expect(templateToContent('{title}')).toBe('string(doc-title)');
  });

  it('splits mixed text into literals and counters, not one string', () => {
    // The whole point: a blind replace would emit "Page counter(page) of ..."
    // inside one quoted string and print the function names verbatim.
    expect(templateToContent('Page {page} of {pages}')).toBe(
      '"Page " counter(page) " of " counter(pages)',
    );
  });

  it('handles a placeholder at each end', () => {
    expect(templateToContent('{page} of {pages}')).toBe(
      'counter(page) " of " counter(pages)',
    );
    expect(templateToContent('see {title}')).toBe('"see " string(doc-title)');
  });

  it('resolves {date} to a literal at build time', () => {
    expect(templateToContent('{date}', { date: '2026-08-16' })).toBe(
      '"2026-08-16"',
    );
    expect(templateToContent('Printed {date}', { date: '2026-08-16' })).toBe(
      '"Printed 2026-08-16"',
    );
  });

  it("defaults {date} to today's ISO date", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(templateToContent('{date}')).toBe(`"${today}"`);
  });

  it('treats {{ as a literal brace', () => {
    expect(templateToContent('{{page}')).toBe('"{page}"');
  });

  it('passes an unrecognised placeholder through as text', () => {
    expect(templateToContent('{nope}')).toBe('"{nope}"');
  });

  it('escapes quotes and backslashes so the CSS stays parseable', () => {
    expect(templateToContent('a "b" c')).toBe('"a \\"b\\" c"');
    expect(templateToContent('a\\b')).toBe('"a\\\\b"');
  });

  it('plain text becomes a single quoted literal', () => {
    expect(templateToContent('Confidential')).toBe('"Confidential"');
  });
});

describe('generateLayoutCSS: page box', () => {
  it('emits @page with the default A4 portrait size and 25mm margins', () => {
    const css = generateLayoutCSS(layout());
    expect(css).toContain('@page {');
    expect(css).toContain('size: A4 portrait');
    expect(css).toContain('margin: 25mm 25mm 25mm 25mm');
  });

  it.each([
    ['letter', 'LETTER portrait'],
    ['legal', 'LEGAL portrait'],
    ['a5', 'A5 portrait'],
    ['a3', 'A3 portrait'],
  ])('uses the named size for %s', (pageSize, expected) => {
    expect(generateLayoutCSS(layout({ pageSize }))).toContain(
      `size: ${expected}`,
    );
  });

  it('applies orientation to named sizes', () => {
    expect(generateLayoutCSS(layout({ orientation: 'landscape' }))).toContain(
      'size: A4 landscape',
    );
  });

  it('emits explicit dimensions for a custom size', () => {
    const css = generateLayoutCSS(
      layout({ pageSize: 'custom', customWidth: 120, customHeight: 200 }),
    );
    expect(css).toContain('size: 120mm 200mm');
  });

  it('swaps custom dimensions for landscape, since the keyword is invalid there', () => {
    const css = generateLayoutCSS(
      layout({
        pageSize: 'custom',
        customWidth: 120,
        customHeight: 200,
        orientation: 'landscape',
      }),
    );
    expect(css).toContain('size: 200mm 120mm');
    expect(css).not.toContain('120mm 200mm landscape');
  });

  it.each([
    ['small', 15],
    ['normal', 25],
    ['wide', 35],
  ])('%s margins resolve to %smm on all sides', (marginPreset, mm) => {
    expect(generateLayoutCSS(layout({ marginPreset }))).toContain(
      `margin: ${mm}mm ${mm}mm ${mm}mm ${mm}mm`,
    );
  });

  it('uses per-side values for custom margins', () => {
    const css = generateLayoutCSS(
      layout({
        marginPreset: 'custom',
        marginTop: 10,
        marginRight: 20,
        marginBottom: 30,
        marginLeft: 40,
      }),
    );
    expect(css).toContain('margin: 10mm 20mm 30mm 40mm');
  });
});

describe('generateLayoutCSS: margin boxes', () => {
  it('emits only the boxes that have content', () => {
    const css = generateLayoutCSS(layout());
    // Defaults: header-right {title}, footer-center {page} / {pages}.
    expect(css).toContain('@top-right');
    expect(css).toContain('@bottom-center');
    expect(css).not.toContain('@top-left');
    expect(css).not.toContain('@bottom-right');
  });

  it('emits no margin boxes at all when every template is empty', () => {
    const css = generateLayoutCSS(
      layout({ headerRight: '', footerCenter: '' }),
    );
    expect(css).not.toContain('@top-');
    expect(css).not.toContain('@bottom-');
  });

  it('substitutes placeholders inside the box', () => {
    const css = generateLayoutCSS(
      layout({ footerCenter: 'Page {page} of {pages}' }),
    );
    expect(css).toContain(
      'content: "Page " counter(page) " of " counter(pages)',
    );
  });

  it('sets up the string-set that {title} reads from', () => {
    const css = generateLayoutCSS(layout({ headerRight: '{title}' }));
    expect(css).toContain('string-set: doc-title content(text)');
    expect(css).toContain('content: string(doc-title)');
  });
});

describe('generateLayoutCSS: fragmentation', () => {
  it('always emits the fragmentation rules', () => {
    const css = generateLayoutCSS(layout());
    expect(css).toContain('break-after: avoid');
    expect(css).toContain('orphans: 3');
    expect(css).toContain('widows: 3');
  });

  it('does not force a page break before headings, so pages flow continuously', () => {
    // Forcing break-before: page on every h1 ended pages early and left a blank
    // band below the last paragraph. Content now flows and fills each page.
    const css = generateLayoutCSS(layout());
    expect(css).not.toContain('break-before: page');
  });

  it('keeps every heading glued to the content that follows it', () => {
    const css = generateLayoutCSS(layout());
    expect(css).toContain('.markdown-body h1,');
    expect(css).toMatch(/\.markdown-body h4 \{ break-after: avoid; \}/);
  });

  it('lets tables split but keeps rows whole and repeats headers', () => {
    // break-inside:avoid on a table taller than the page overflows instead of
    // splitting, which loses content.
    const css = generateLayoutCSS(layout());
    expect(css).toContain('.markdown-body table { break-inside: auto; }');
    expect(css).toContain('display: table-header-group');
    expect(css).toContain('.markdown-body tr { break-inside: avoid; }');
  });

  it('unconstrains .markdown-body width inside a page', () => {
    expect(generateLayoutCSS(layout())).toContain(
      '.pagedjs_page_content .markdown-body { max-width: none;',
    );
  });
});

describe('generateLayoutCSS: cover', () => {
  it('omits cover rules when disabled', () => {
    const css = generateLayoutCSS(layout());
    expect(css).not.toContain('@page cover');
    expect(css).not.toContain('wp-cover-page');
  });

  it('emits a named cover page with no margin boxes when enabled', () => {
    const css = generateLayoutCSS(
      layout({ cover: { ...DEFAULTS.cover, enabled: true } }),
    );
    expect(css).toContain('.wp-cover-page { page: cover;');
    expect(css).toContain('@page cover');
    expect(css).toContain('@top-right { content: none; }');
    expect(css).toContain('@bottom-center { content: none; }');
  });

  it('breaks after the cover via the cover page itself, not an h1 override', () => {
    // Headings no longer force a page break, so the cover owns its own sheet
    // through break-after on .wp-cover-page and needs no h1:first-child rule to
    // cancel a break that is no longer emitted.
    const css = generateLayoutCSS(
      layout({ cover: { ...DEFAULTS.cover, enabled: true } }),
    );
    expect(css).toContain('.wp-cover-page { page: cover; break-after: page; }');
    expect(css).not.toContain('h1:first-child { break-before: auto; }');
  });
});

describe('generateLayoutCSS: TOC', () => {
  it('omits TOC rules when disabled', () => {
    expect(generateLayoutCSS(layout())).not.toContain('.wp-toc');
  });

  it('emits target-counter when enabled', () => {
    const css = generateLayoutCSS(layout({ toc: { enabled: true, depth: 2 } }));
    expect(css).toContain('.wp-toc a::after');
    expect(css).toContain('content: target-counter(attr(href), page)');
  });

  it('uses attr(href), not attr(href url)', () => {
    // paged.js reads every Identifier inside attr() as an argument, so the
    // `url` type keyword becomes a bogus second argument and the lookup fails.
    const css = generateLayoutCSS(layout({ toc: { enabled: true, depth: 2 } }));
    expect(css).not.toContain('attr(href url)');
  });

  it('does not use leader(), which nothing implements', () => {
    // leader() is in the Paged Media spec but neither paged.js nor any browser
    // supports it, and an unknown function invalidates the whole content value
    // — taking the page numbers down with the dots. A flex filler replaces it.
    const css = generateLayoutCSS(layout({ toc: { enabled: true, depth: 2 } }));
    expect(css).not.toContain('leader(');
    expect(css).toContain('.wp-toc a::before');
    expect(css).toContain('border-bottom: 1px dotted');
  });

  it('depth does not change the CSS — it is a DOM-side concern', () => {
    const one = generateLayoutCSS(layout({ toc: { enabled: true, depth: 1 } }));
    const three = generateLayoutCSS(
      layout({ toc: { enabled: true, depth: 3 } }),
    );
    expect(one).toBe(three);
  });
});

describe('generateLayoutCSS: watermark', () => {
  it('omits the rule when the text is empty', () => {
    expect(generateLayoutCSS(layout())).not.toContain(
      'pagedjs_page_content::before',
    );
  });

  it('emits a rotated pseudo-element when text is set', () => {
    const css = generateLayoutCSS(
      layout({
        watermark: { text: 'DRAFT', opacity: 0.2, showInPreview: true },
      }),
    );
    expect(css).toContain('.pagedjs_page_content::before');
    expect(css).toContain('content: "DRAFT"');
    expect(css).toContain('rotate(-45deg)');
    expect(css).toContain('opacity: 0.2');
    expect(css).toContain('print-color-adjust: exact');
  });

  it('targets page_content, not the page element paged.js uses itself', () => {
    const css = generateLayoutCSS(
      layout({ watermark: { text: 'X', opacity: 0.1, showInPreview: true } }),
    );
    // .pagedjs_page::before is where paged.js puts its own margin boxes.
    expect(css).not.toMatch(/\.pagedjs_page::before/);
  });

  it('hides it on screen unless showInPreview is set', () => {
    const hidden = generateLayoutCSS(
      layout({ watermark: { text: 'X', opacity: 0.1, showInPreview: false } }),
    );
    expect(hidden).toContain('@media screen');
    expect(hidden).toContain('content: none');

    const shown = generateLayoutCSS(
      layout({ watermark: { text: 'X', opacity: 0.1, showInPreview: true } }),
    );
    expect(shown).not.toContain('@media screen');
  });

  it('escapes quotes in the watermark text', () => {
    const css = generateLayoutCSS(
      layout({ watermark: { text: 'a"b', opacity: 0.1, showInPreview: true } }),
    );
    expect(css).toContain('content: "a\\"b"');
  });
});

describe('applyLayoutCSS', () => {
  beforeEach(() => {
    document.getElementById(LAYOUT_STYLE_ID)?.remove();
  });

  it('creates the style element on first call', () => {
    applyLayoutCSS(layout());
    const el = document.getElementById(LAYOUT_STYLE_ID);
    expect(el).toBeTruthy();
    expect(el.tagName).toBe('STYLE');
    expect(el.textContent).toContain('@page');
  });

  it('reuses the same element on subsequent calls', () => {
    applyLayoutCSS(layout());
    const first = document.getElementById(LAYOUT_STYLE_ID);
    applyLayoutCSS(layout({ pageSize: 'letter' }));
    const second = document.getElementById(LAYOUT_STYLE_ID);
    expect(second).toBe(first);
    expect(second.textContent).toContain('LETTER');
    expect(document.querySelectorAll(`#${LAYOUT_STYLE_ID}`)).toHaveLength(1);
  });

  it('returns the generated CSS', () => {
    expect(applyLayoutCSS(layout())).toContain('@page');
  });
});
