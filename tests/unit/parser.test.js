import { describe, it, expect } from 'vitest';
import { md } from '@/App/Components/Previewer/Preview.jsx';
import { readFileWithEncoding } from '@/App/Lib/readFile.js';

// These assert against the SAME markdown-it instance the app renders with.

describe('markdown-it: core parsing', () => {
  it('parses ATX headings', () => {
    expect(md.render('# Heading One')).toContain('<h1>Heading One</h1>');
    expect(md.render('### Heading Three')).toContain('<h3>Heading Three</h3>');
  });

  it('parses paragraphs and inline emphasis', () => {
    const html = md.render('A **bold** and *italic* and ~~struck~~ line.');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<s>struck</s>');
  });

  it('parses fenced code blocks with language highlighting', () => {
    const html = md.render('```javascript\nconst a = 1;\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('class="hljs language-javascript"');
    // highlight.js should have tokenised the keyword
    expect(html).toContain('hljs-keyword');
  });

  it('parses unlabeled fences via highlightAuto', () => {
    const html = md.render('```\nSELECT 1;\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('class="hljs"');
  });

  it('parses GFM tables', () => {
    const html = md.render('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>a</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('parses blockquotes', () => {
    const html = md.render('> quoted text');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('quoted text');
  });

  it('parses explicit links', () => {
    const html = md.render('[label](https://example.com)');
    expect(html).toContain('<a href="https://example.com">label</a>');
  });

  it('linkifies bare URLs (linkify: true)', () => {
    const html = md.render('visit https://example.com now');
    expect(html).toContain('<a href="https://example.com">');
  });

  it('passes raw HTML through (html: true, matches upstream)', () => {
    const html = md.render('<span style="color:#0984e3">html</span>');
    expect(html).toContain('<span style="color:#0984e3">html</span>');
  });

  it('leaves typographic replacements alone (typographer: false)', () => {
    const html = md.render('He said "hello" -- it is fine... (c)');
    expect(html).not.toContain('&ldquo;');
    expect(html).toContain('--');
    expect(html).toContain('(c)');
  });

  it('parses ordered and unordered lists', () => {
    expect(md.render('1. one\n2. two')).toContain('<ol>');
    expect(md.render('- one\n- two')).toContain('<ul>');
  });

  it('renders CJK, emoji and Unicode math symbols without mangling', () => {
    expect(md.render('反選頁首與頁尾')).toContain('反選頁首與頁尾');
    expect(md.render('👨🏻‍💻️ 🇹🇼')).toContain('👨🏻‍💻️ 🇹🇼');
    expect(md.render('∑ ∫ ≠ ∞ α')).toContain('∑ ∫ ≠ ∞ α');
  });
});

// ---------------------------------------------------------------------------
// BASELINE BUG DOCUMENTATION
//
// The assertions below deliberately encode CURRENTLY-BROKEN behaviour so the
// bugs are pinned rather than forgotten. They are expected to be INVERTED in
// later phases:
//   - BOM handling      -> Phase 3  (DONE, inverted below)
//   - math delimiters   -> Phase 4
// If one of these starts failing, a fix landed early. Flip the assertion and
// move the note, do not delete the test.
// ---------------------------------------------------------------------------

describe('FIXED in Phase 3: BOM no longer breaks the first heading', () => {
  it('still demotes a BOM-prefixed h1 at the PARSER level', () => {
    // markdown-it is unchanged and this is not a markdown-it bug: U+FEFF is a
    // legitimate character and a line starting with one is not an ATX heading.
    // The fix belongs one layer up, in the file reader — pinned here so nobody
    // "fixes" it again inside the parser.
    const html = md.render('﻿# Heading after BOM');
    expect(html).not.toContain('<h1>');
    expect(html).toContain('#');
  });

  it('parses the heading correctly once the BOM is stripped', () => {
    expect(md.render('# Heading after BOM')).toContain(
      '<h1>Heading after BOM</h1>',
    );
  });

  it('renders an h1 end-to-end from a BOM-prefixed file', async () => {
    // The real contract: a file with a BOM produces a heading. Piped through
    // the reader, which is where Phase 3 put the fix.
    const source = '# Heading after BOM\n\nParagraph.\n';
    const withBom = new TextEncoder().encode('﻿' + source);
    const file = {
      name: 'bom.md',
      arrayBuffer: async () => withBom.buffer,
    };

    const { text, wasBOM } = await readFileWithEncoding(file);
    expect(wasBOM).toBe(true);
    expect(md.render(text)).toContain('<h1>Heading after BOM</h1>');
  });
});

describe('BASELINE BUG (Phase 4): math delimiters are unsupported', () => {
  it('mangles \\(...\\) by consuming the backslashes', () => {
    const html = md.render('Pythagoras: \\(a^2 + b^2 = c^2\\) here');

    // BUG: backslash-paren is treated as an escape, so the delimiters vanish
    // and what remains is indistinguishable from ordinary parenthesised text.
    expect(html).toContain('(a^2 + b^2 = c^2)');
    expect(html).not.toContain('\\(');
  });

  it('leaves $...$ inline math as literal text', () => {
    const html = md.render('Euler: $e^{i\\pi} + 1 = 0$ end');
    expect(html).toContain('$e^{i\\pi} + 1 = 0$');
    expect(html).not.toContain('katex');
    expect(html).not.toContain('<math');
  });

  it('leaves $$...$$ block math as literal text', () => {
    const html = md.render('$$\\int_{0}^{1} x^2 dx = \\frac{1}{3}$$');
    expect(html).toContain('$$');
    expect(html).not.toContain('<math');
  });

  it('renders a ```math fence as a code block, not math', () => {
    const html = md.render('```math\nE = mc^2\n```');
    expect(html).toContain('<pre>');
    expect(html).not.toContain('<math');
  });
});
