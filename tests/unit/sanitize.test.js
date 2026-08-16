import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitize } from '@/App/Lib/sanitize.js';
import { renderDocument } from '@/App/Components/Previewer/Preview.jsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (n) =>
  fs.readFileSync(path.resolve(__dirname, '../fixtures', n), 'utf8');

describe('sanitize: strips the dangerous', () => {
  it('removes script tags', () => {
    const out = sanitize('<p>ok</p><script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).toContain('<p>ok</p>');
  });

  it('removes inline event handlers', () => {
    const out = sanitize('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
  });

  it('neutralises javascript: URLs', () => {
    const out = sanitize('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
  });

  it('removes iframes, objects and embeds', () => {
    for (const tag of ['iframe', 'object', 'embed']) {
      expect(sanitize(`<${tag} src="x"></${tag}>`)).not.toContain(`<${tag}`);
    }
  });

  it('removes style tags, which can exfiltrate via background-image', () => {
    expect(sanitize('<style>body{}</style>')).not.toContain('<style');
  });

  it('handles empty and non-string input', () => {
    expect(sanitize('')).toBe('');
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
  });
});

describe('sanitize: preserves what four phases built', () => {
  it('keeps KaTeX output intact', () => {
    // Rendered through the real pipeline rather than a hand-written sample, so
    // the allow-list is tested against what KaTeX actually emits.
    const { html } = renderDocument('$e^{i\\pi} + 1 = 0$\n');
    const out = sanitize(html);
    expect(out).toContain('class="katex"');
    expect(out).toContain('data-latex');
    // Phase 4's copy button reads data-latex; stripping it would break it.
    expect(out).toMatch(/<span class="katex" data-latex=/);
  });

  it('keeps display math and its structure', () => {
    const { html } = renderDocument('$$\n\\frac{1}{2}\n$$\n');
    const out = sanitize(html);
    expect(out).toContain('katex-display');
    expect(out).toContain('mord');
  });

  it('keeps callout structure', () => {
    const { html } = renderDocument(':::warning Careful\nbody\n:::\n');
    const out = sanitize(html);
    expect(out).toContain('class="callout callout-warning"');
    expect(out).toContain('class="callout-title"');
    expect(out).toContain('class="callout-body"');
  });

  it('keeps task list checkboxes and their state', () => {
    const { html } = renderDocument('- [x] done\n- [ ] todo\n');
    const out = sanitize(html);
    expect(out).toContain('task-list-item-checkbox');
    expect(out).toContain('checked');
  });

  it('keeps highlighted code spans', () => {
    const { html } = renderDocument('```js\nconst a = 1;\n```\n');
    const out = sanitize(html);
    expect(out).toContain('class="hljs-');
  });

  it('keeps SVG of the shape mermaid emits', () => {
    const svg =
      '<div class="mermaid-diagram"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
      '<g><path d="M0 0 L10 10"/><marker id="m"/><foreignObject><span>x</span></foreignObject></g></svg></div>';
    const out = sanitize(svg);
    expect(out).toContain('<svg');
    expect(out).toContain('<g>');
    expect(out).toContain('<path');
    expect(out).toContain('mermaid-diagram');
  });

  it('keeps ordinary document structure', () => {
    const { html } = renderDocument(
      '# H\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n> quote\n\n![alt](img.png)\n',
    );
    const out = sanitize(html);
    for (const needle of ['<h1>', '<table>', '<blockquote>', '<img']) {
      expect(out).toContain(needle);
    }
  });
});

describe('renderDocument sanitize flag', () => {
  const xss = read('xss.md');

  it('leaves HTML alone when off, which is the Phase 0 behaviour', () => {
    const { html } = renderDocument(xss, { sanitizeHtml: false });
    expect(html).toContain('<script');
    expect(html).toContain('onerror');
  });

  it('strips it when on, and keeps math and callouts', () => {
    const { html } = renderDocument(xss, { sanitizeHtml: true });
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<iframe');
    // Everything legitimate in the same document survives.
    expect(html).toContain('class="katex"');
    expect(html).toContain('callout-warning');
  });

  it('defaults to off', () => {
    expect(renderDocument(xss).html).toContain('<script');
  });
});
