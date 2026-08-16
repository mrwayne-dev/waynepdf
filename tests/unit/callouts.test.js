import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { md, CALLOUT_TYPES } from '@/App/Components/Previewer/Preview.jsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (n) =>
  fs.readFileSync(path.resolve(__dirname, '../fixtures', n), 'utf8');

describe('callouts', () => {
  it('registers exactly the five documented types', () => {
    expect(CALLOUT_TYPES).toEqual(['note', 'tip', 'warning', 'danger', 'info']);
  });

  it.each(CALLOUT_TYPES)(
    '%s renders with its class and default title',
    (type) => {
      const html = md.render(`:::${type}\nbody\n:::\n`);
      expect(html).toContain(`class="callout callout-${type}"`);
      const title = type.charAt(0).toUpperCase() + type.slice(1);
      expect(html).toContain(`<div class="callout-title">${title}</div>`);
      expect(html).toContain('class="callout-body"');
    },
  );

  it('a custom title on the fence line overrides the default', () => {
    const html = md.render(':::warning Read This First\nbody\n:::\n');
    expect(html).toContain('<div class="callout-title">Read This First</div>');
    expect(html).not.toContain('>Warning<');
  });

  it('escapes HTML in a custom title', () => {
    const html = md.render(':::note <img src=x onerror=1>\nbody\n:::\n');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('renders markdown inside the body', () => {
    const html = md.render(
      ':::tip\n**bold** and `code` and [a](https://x.test)\n:::\n',
    );
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<a href="https://x.test">');
  });

  it('supports a nested list and a nested fence', () => {
    const html = md.render(
      ':::info\n- one\n- two\n\n```js\nconst a = 1;\n```\n:::\n',
    );
    expect(html).toContain('<ul>');
    expect(html).toContain('language-js');
  });

  it('an unclosed callout still terminates', () => {
    // markdown-it closes open containers at EOF; the guard here is that it
    // returns at all rather than looping.
    expect(() => md.render(':::warning\nno closing fence\n')).not.toThrow();
    expect(md.render(':::warning\nno closing fence\n')).toContain(
      'callout-warning',
    );
  });

  it('an unknown type is left as ordinary text, not a broken callout', () => {
    const html = md.render(':::nonsense\nbody\n:::\n');
    expect(html).not.toContain('class="callout');
  });

  it('renders every type in the fixture', () => {
    const html = md.render(read('callouts.md'));
    for (const type of CALLOUT_TYPES) {
      expect(html).toContain(`callout-${type}`);
    }
    // Six blocks total: five types plus a second note.
    expect((html.match(/class="callout callout-/g) ?? []).length).toBe(6);
    expect(html).toContain('Custom Warning Title');
  });
});

describe('task lists', () => {
  it('renders checkboxes with the checked state from the source', () => {
    const html = md.render('- [x] done\n- [ ] todo\n');
    expect(html).toContain('contains-task-list');
    expect(html).toContain('task-list-item-checkbox');
    expect(html).toContain('checked=""');
  });

  it('disables the checkboxes — the preview is not an editor', () => {
    const html = md.render('- [ ] todo\n');
    expect(html).toContain('disabled=""');
  });

  it('handles nesting and mixed plain items', () => {
    const html = md.render(read('tasks.md'));
    // Six in the first list (three of them nested), one after the plain bullet.
    const boxes = (html.match(/task-list-item-checkbox/g) ?? []).length;
    expect(boxes).toBe(7);
    const checked = (html.match(/checked=""/g) ?? []).length;
    expect(checked).toBe(3);
  });

  it('leaves an ordinary list alone', () => {
    const html = md.render('- plain\n- items\n');
    expect(html).not.toContain('task-list-item');
  });
});

describe('mermaid fences', () => {
  it('are tagged for the renderer and never highlighted', () => {
    const html = md.render('```mermaid\ngraph LR\n A-->B\n```\n');
    // MermaidRenderer keys on this class; without it no diagram renders.
    expect(html).toContain('class="language-mermaid"');
    expect(html).not.toContain('class="hljs-');
  });

  it('escape their source so a diagram cannot inject HTML', () => {
    const html = md.render('```mermaid\n<img src=x onerror=1>\n```\n');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('leave other fences untouched', () => {
    expect(md.render('```js\nconst a = 1;\n```\n')).toContain('language-js');
  });
});
