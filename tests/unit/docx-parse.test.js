import { describe, it, expect, beforeAll } from 'vitest';
import { parseMarkdown, parseInline } from '@/App/Lib/docx/parse.js';

/*
 * markdown → IR.
 *
 * The IR exists so this question — "did the parse understand the document" — can
 * be asked without unzipping a .docx to find the answer.
 */

let md;
beforeAll(async () => {
  // The app's own instance, so the DOCX writer sees exactly what the preview
  // parses: same plugins, same options, same edge cases.
  ({ md } = await import('@/App/Components/Previewer/Preview.jsx'));
});

const parse = (markdown) => parseMarkdown(markdown, md);
const text = (runs) => runs.map((r) => r.text).join('');

describe('blocks', () => {
  it('produces nothing for empty input', () => {
    expect(parse('')).toEqual([]);
    expect(parse('   \n\n  ')).toEqual([]);
    expect(parseMarkdown(null, md)).toEqual([]);
  });

  it('reads a paragraph', () => {
    const blocks = parse('Just some text.');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
    expect(text(blocks[0].runs)).toBe('Just some text.');
  });

  it.each([1, 2, 3, 4, 5, 6])('reads an h%i', (level) => {
    const blocks = parse(`${'#'.repeat(level)} Heading`);
    expect(blocks[0]).toMatchObject({ type: 'heading', level });
    expect(text(blocks[0].runs)).toBe('Heading');
  });

  it('reads a horizontal rule', () => {
    expect(parse('a\n\n---\n\nb').some((b) => b.type === 'hr')).toBe(true);
  });

  it('reads a fenced code block with its language', () => {
    const blocks = parse('```javascript\nconst a = 1;\n```');
    expect(blocks[0]).toMatchObject({ type: 'code', language: 'javascript' });
    expect(blocks[0].content).toBe('const a = 1;');
  });

  it('keeps blank lines inside code but drops the trailing newline', () => {
    const blocks = parse('```\na\n\nb\n```');
    expect(blocks[0].content).toBe('a\n\nb');
  });

  it('reads a fence with no language', () => {
    expect(parse('```\nplain\n```')[0]).toMatchObject({
      type: 'code',
      language: '',
    });
  });
});

describe('inline formatting', () => {
  it('splits bold, plain and italic into separate runs', () => {
    const [block] = parse('**bold** and *italic*');
    expect(block.runs).toEqual([
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'italic', italic: true },
    ]);
  });

  it('marks inline code', () => {
    const [block] = parse('use `npm install` first');
    expect(block.runs.find((r) => r.code)).toEqual({
      text: 'npm install',
      code: true,
    });
  });

  it('marks strikethrough', () => {
    const [block] = parse('~~gone~~');
    expect(block.runs[0]).toEqual({ text: 'gone', strike: true });
  });

  it('carries a link target on its runs', () => {
    const [block] = parse('see [the docs](https://example.com) now');
    const link = block.runs.find((r) => r.link);
    expect(link).toEqual({ text: 'the docs', link: 'https://example.com' });
  });

  it('combines nested emphasis', () => {
    const [block] = parse('***both***');
    expect(block.runs[0]).toMatchObject({ bold: true, italic: true });
  });

  it('leaves escaped delimiters as literal characters', () => {
    // The document is full of `$` and `_`; a backslash-escaped one must arrive
    // as itself with no formatting applied.
    const [block] = parse('a \\_not italic\\_ and \\$5');
    expect(text(block.runs)).toContain('_not italic_');
    expect(text(block.runs)).toContain('$5');
    expect(block.runs.some((r) => r.italic)).toBe(false);
  });

  it('keeps math as literal source text', () => {
    // Documented limitation: DOCX gets the source, not typeset math.
    const [block] = parse('Inline: $e^{i\\pi} + 1 = 0$.');
    expect(text(block.runs)).toContain('$e^{i\\pi} + 1 = 0$');
  });

  it('drops empty runs rather than emitting empty <w:t>', () => {
    const [block] = parse('**bold**');
    expect(block.runs).toHaveLength(1);
  });

  it('handles a bare inline token without children', () => {
    expect(parseInline(undefined)).toEqual({ runs: [], images: [] });
    expect(parseInline({})).toEqual({ runs: [], images: [] });
  });
});

describe('lists', () => {
  it('reads a flat bullet list', () => {
    const [block] = parse('- one\n- two');
    expect(block).toMatchObject({ type: 'list', ordered: false });
    expect(block.items).toHaveLength(2);
    expect(text(block.items[0].runs)).toBe('one');
  });

  it('reads an ordered list', () => {
    const [block] = parse('1. first\n2. second');
    expect(block.ordered).toBe(true);
    expect(block.items).toHaveLength(2);
  });

  it('records nesting depth on each item', () => {
    const [block] = parse('- a\n  - b\n    - c');
    const levels = block.items.map((item) => item.level);
    expect(levels).toEqual([0, 1, 2]);
    expect(text(block.items[2].runs)).toBe('c');
  });

  it('captures task list state', () => {
    const [block] = parse('- [x] done\n- [ ] pending');
    expect(block.items[0].checkbox).toBe(true);
    expect(block.items[1].checkbox).toBe(false);
    expect(text(block.items[0].runs)).toContain('done');
  });

  it('leaves checkbox undefined on a plain list item', () => {
    const [block] = parse('- plain');
    expect(block.items[0].checkbox).toBeUndefined();
  });
});

describe('tables', () => {
  it('separates the header row from the body', () => {
    const [block] = parse(
      '| Feature | Status |\n| --- | --- |\n| Themes | Ready |\n| Math | Ready |',
    );
    expect(block.type).toBe('table');
    expect(block.headers.map(text)).toEqual(['Feature', 'Status']);
    expect(block.rows).toHaveLength(2);
    expect(block.rows[0].map(text)).toEqual(['Themes', 'Ready']);
  });

  it('keeps inline formatting inside cells', () => {
    const [block] = parse('| a |\n| --- |\n| **bold** |');
    expect(block.rows[0][0][0]).toMatchObject({ text: 'bold', bold: true });
  });
});

describe('blockquotes and callouts', () => {
  it('reads a blockquote as nested blocks', () => {
    const [block] = parse('> quoted text');
    expect(block.type).toBe('blockquote');
    expect(block.calloutType).toBeUndefined();
    expect(block.children[0].type).toBe('paragraph');
    expect(text(block.children[0].runs)).toBe('quoted text');
  });

  it.each(['note', 'tip', 'warning', 'danger', 'info'])(
    'reads a %s callout',
    (type) => {
      const [block] = parse(`::: ${type}\nbody text\n:::`);
      expect(block).toMatchObject({ type: 'blockquote', calloutType: type });
      expect(text(block.children[0].runs)).toBe('body text');
    },
  );

  it('keeps a callout title', () => {
    const [block] = parse('::: warning Heads up\nbody\n:::');
    expect(block.calloutTitle).toBe('Heads up');
  });

  it('does NOT treat a callout inside a code fence as a callout', () => {
    /*
     * The reason callouts are read from tokens rather than rewritten with a
     * regex: markdown-it already knows a fence when it sees one, so this cannot
     * go wrong by construction.
     */
    const blocks = parse('```\n::: note\nnot a callout\n:::\n```');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('code');
    expect(blocks[0].content).toContain('::: note');
  });

  it('flattens a nested blockquote without losing its text', () => {
    const [block] = parse('> outer\n>\n> > inner');
    const flat = JSON.stringify(block);
    expect(flat).toContain('outer');
    expect(flat).toContain('inner');
  });
});

describe('images', () => {
  const PIXEL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('lifts an image out of its paragraph into its own block', () => {
    // OOXML has no way to put a picture in a text run's sibling stream the way
    // HTML does, so images have to be blocks.
    const blocks = parse(`![alt text](${PIXEL})`);
    const image = blocks.find((b) => b.type === 'image');
    expect(image).toMatchObject({ dataUri: PIXEL, alt: 'alt text' });
  });

  it('keeps the data URI byte-for-byte', () => {
    const [image] = parse(`![](${PIXEL})`).filter((b) => b.type === 'image');
    expect(image.dataUri).toBe(PIXEL);
  });
});
