import { describe, it, expect } from 'vitest';
import {
  slugify,
  ensureHeadingIds,
  buildToc,
  buildCover,
  deriveTitle,
  preprocess,
} from '@/App/Lib/paginatorPreprocess.js';
import { DEFAULTS, normalizeLayout } from '@/App/Container/Hooks/useLayout.js';

const layout = (over = {}) => normalizeLayout({ ...DEFAULTS, ...over });
const div = (html) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

describe('slugify', () => {
  it.each([
    ['Hello World', 'hello-world'],
    ['  Trim  Me  ', 'trim-me'],
    ['Punctuation! Goes: Away?', 'punctuation-goes-away'],
    ['Multiple   Spaces', 'multiple-spaces'],
    ['Already-Hyphenated', 'already-hyphenated'],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('keeps non-Latin letters rather than emptying the slug', () => {
    expect(slugify('日本語のテスト')).toBe('日本語のテスト');
    expect(slugify('اختبار عربي')).toBe('اختبار-عربي');
  });

  it('falls back to "section" when nothing survives', () => {
    expect(slugify('!!!')).toBe('section');
    expect(slugify('')).toBe('section');
  });
});

describe('ensureHeadingIds', () => {
  it('adds slugified ids to headings that lack them', () => {
    const root = ensureHeadingIds(
      div('<h1>Intro</h1><h2>Getting Started</h2>'),
    );
    expect(root.querySelector('h1').id).toBe('intro');
    expect(root.querySelector('h2').id).toBe('getting-started');
  });

  it('preserves ids that already exist', () => {
    const root = ensureHeadingIds(div('<h1 id="custom">Intro</h1>'));
    expect(root.querySelector('h1').id).toBe('custom');
  });

  it('disambiguates duplicate headings with a numeric suffix', () => {
    const root = ensureHeadingIds(
      div('<h2>Overview</h2><h2>Overview</h2><h2>Overview</h2>'),
    );
    const ids = [...root.querySelectorAll('h2')].map((h) => h.id);
    expect(ids).toEqual(['overview', 'overview-1', 'overview-2']);
    expect(new Set(ids).size).toBe(3);
  });

  it('covers all six heading levels', () => {
    const root = ensureHeadingIds(
      div('<h1>A</h1><h2>B</h2><h3>C</h3><h4>D</h4><h5>E</h5><h6>F</h6>'),
    );
    for (const h of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      expect(h.id).toBeTruthy();
    }
  });
});

describe('buildToc', () => {
  const source = () =>
    ensureHeadingIds(
      div('<h1>One</h1><h2>One A</h2><h3>Deep</h3><h2>One B</h2><h1>Two</h1>'),
    );

  it('returns null when there are no headings', () => {
    expect(buildToc(document, div('<p>text</p>'), 3)).toBeNull();
  });

  it('lists only headings within the depth limit', () => {
    const d1 = buildToc(document, source(), 1);
    expect([...d1.querySelectorAll('a')].map((a) => a.textContent)).toEqual([
      'One',
      'Two',
    ]);

    const d2 = buildToc(document, source(), 2);
    expect([...d2.querySelectorAll('a')].map((a) => a.textContent)).toEqual([
      'One',
      'One A',
      'One B',
      'Two',
    ]);

    const d3 = buildToc(document, source(), 3);
    expect(d3.querySelectorAll('a')).toHaveLength(5);
  });

  it('links each entry to its heading id', () => {
    const toc = buildToc(document, source(), 2);
    const hrefs = [...toc.querySelectorAll('a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(['#one', '#one-a', '#one-b', '#two']);
  });

  it('nests deeper levels inside the parent entry', () => {
    const toc = buildToc(document, source(), 3);
    // h3 "Deep" must live in a list nested under the h2 "One A" item.
    const deepLink = [...toc.querySelectorAll('a')].find(
      (a) => a.textContent === 'Deep',
    );
    const nestedList = deepLink.closest('ol');
    expect(nestedList.parentElement.tagName).toBe('LI');
    expect(nestedList.parentElement.querySelector('a').textContent).toBe(
      'One A',
    );
  });

  it('carries a Contents title', () => {
    const toc = buildToc(document, source(), 2);
    expect(toc.querySelector('h2').textContent).toBe('Contents');
    expect(toc.className).toBe('wp-toc');
  });

  it('handles a document that starts below h1', () => {
    const root = ensureHeadingIds(div('<h2>Alpha</h2><h2>Beta</h2>'));
    const toc = buildToc(document, root, 2);
    expect(toc.querySelectorAll('a')).toHaveLength(2);
  });

  it('does not crash when a level is skipped', () => {
    const root = ensureHeadingIds(div('<h1>A</h1><h3>C</h3>'));
    expect(() => buildToc(document, root, 3)).not.toThrow();
    expect(buildToc(document, root, 3).querySelectorAll('a')).toHaveLength(2);
  });
});

describe('buildCover', () => {
  const root = () => div('<h1>Document Heading</h1><p>body</p>');

  it('uses the user title when set', () => {
    const cover = buildCover(document, root(), {
      ...DEFAULTS.cover,
      title: 'My Title',
    });
    expect(cover.querySelector('.wp-cover-title').textContent).toBe('My Title');
  });

  it('falls back to the first H1 when the title is blank', () => {
    const cover = buildCover(document, root(), DEFAULTS.cover);
    expect(cover.querySelector('.wp-cover-title').textContent).toBe(
      'Document Heading',
    );
  });

  it('falls back to "Document" when there is no H1 either', () => {
    const cover = buildCover(document, div('<p>body</p>'), DEFAULTS.cover);
    expect(cover.querySelector('.wp-cover-title').textContent).toBe('Document');
  });

  it('omits subtitle and author when blank', () => {
    const cover = buildCover(document, root(), DEFAULTS.cover);
    expect(cover.querySelector('.wp-cover-subtitle')).toBeNull();
    expect(cover.querySelector('.wp-cover-author').textContent).toBe('');
  });

  it('includes subtitle and author when provided', () => {
    const cover = buildCover(document, root(), {
      ...DEFAULTS.cover,
      subtitle: 'A subtitle',
      author: 'M. Mgbah',
    });
    expect(cover.querySelector('.wp-cover-subtitle').textContent).toBe(
      'A subtitle',
    );
    expect(cover.querySelector('.wp-cover-author').textContent).toBe(
      'M. Mgbah',
    );
  });

  it("defaults the date to today's ISO date", () => {
    const cover = buildCover(document, root(), DEFAULTS.cover);
    expect(cover.querySelector('.wp-cover-date').textContent).toBe(
      new Date().toISOString().slice(0, 10),
    );
  });

  it('respects a user-supplied date', () => {
    const cover = buildCover(document, root(), {
      ...DEFAULTS.cover,
      date: 'Spring 2026',
    });
    expect(cover.querySelector('.wp-cover-date').textContent).toBe(
      'Spring 2026',
    );
  });
});

describe('deriveTitle', () => {
  const root = div('<h1>From Heading</h1>');

  it('prefers the cover title when the cover is enabled', () => {
    expect(
      deriveTitle(
        layout({ cover: { ...DEFAULTS.cover, enabled: true, title: 'Cover' } }),
        root,
      ),
    ).toBe('Cover');
  });

  it('ignores the cover title when the cover is disabled', () => {
    expect(
      deriveTitle(
        layout({
          cover: { ...DEFAULTS.cover, enabled: false, title: 'Cover' },
        }),
        root,
      ),
    ).toBe('From Heading');
  });

  it('falls back to the first H1', () => {
    expect(deriveTitle(layout(), root)).toBe('From Heading');
  });

  it('falls back to "Document" with no H1', () => {
    expect(deriveTitle(layout(), div('<p>x</p>'))).toBe('Document');
  });
});

describe('preprocess', () => {
  const html = '<h1>Title</h1><h2>Sub</h2><p>Body</p>';

  it('wraps the source in a .markdown-body, detached from the live DOM', () => {
    const out = preprocess(html, layout());
    expect(out.className).toBe('wp-paged-source');
    expect(out.querySelector('.markdown-body')).toBeTruthy();
    expect(out.isConnected).toBe(false);
  });

  it('assigns heading ids', () => {
    const out = preprocess(html, layout());
    expect(out.querySelector('h1').id).toBe('title');
  });

  it('emits neither cover nor TOC by default', () => {
    const out = preprocess(html, layout());
    expect(out.querySelector('.wp-cover-page')).toBeNull();
    expect(out.querySelector('.wp-toc')).toBeNull();
  });

  it('puts the cover before everything else', () => {
    const out = preprocess(
      html,
      layout({ cover: { ...DEFAULTS.cover, enabled: true } }),
    );
    expect(out.firstElementChild.className).toBe('wp-cover-page');
  });

  it('puts the TOC after the cover and before the body', () => {
    const out = preprocess(
      html,
      layout({
        cover: { ...DEFAULTS.cover, enabled: true },
        toc: { enabled: true, depth: 2 },
      }),
    );
    const classes = [...out.children].map((c) => c.className);
    expect(classes).toEqual(['wp-cover-page', 'wp-toc', 'markdown-body']);
  });

  it('puts the TOC first when there is no cover', () => {
    const out = preprocess(html, layout({ toc: { enabled: true, depth: 2 } }));
    expect([...out.children].map((c) => c.className)).toEqual([
      'wp-toc',
      'markdown-body',
    ]);
  });

  it('handles empty input without throwing', () => {
    expect(() => preprocess('', layout())).not.toThrow();
    expect(() => preprocess(undefined, layout())).not.toThrow();
  });

  it('omits the TOC when the document has no headings', () => {
    const out = preprocess(
      '<p>no headings</p>',
      layout({ toc: { enabled: true, depth: 2 } }),
    );
    expect(out.querySelector('.wp-toc')).toBeNull();
  });
});
