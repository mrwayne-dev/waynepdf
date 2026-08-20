import { describe, it, expect } from 'vitest';
import { buildDocument } from '@/App/Lib/docx/buildDocument.js';
import { xmlEscape } from '@/App/Lib/docx/xmlEscape.js';
import {
  pngDimensions,
  pngDimensionsFromBytes,
} from '@/App/Lib/docx/pngDimensions.js';

/* IR → word/document.xml. */

/** 1x1 transparent PNG. */
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
/** 4x2, so a non-square case is covered. */
const WIDE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAABytg0kAAAAFElEQVR4nGP8//8/AzJgYkACg4kDAI5EAxKD5Q4jAAAAAElFTkSuQmCC';

const build = (blocks) => buildDocument(blocks);
const xmlOf = (blocks) => build(blocks).documentXml;

describe('document shell', () => {
  it('is a complete w:document with a section', () => {
    const xml = xmlOf([]);
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
    expect(xml).toContain('<w:body>');
    expect(xml).toContain('<w:sectPr>');
    // Letter, one-inch margins, in twips.
    expect(xml).toContain('<w:pgSz w:w="12240" w:h="15840"/>');
    expect(xml.trimEnd().endsWith('</w:document>')).toBe(true);
  });

  it('ignores an unknown block type rather than emitting junk', () => {
    expect(xmlOf([{ type: 'nonsense' }])).toContain('<w:body><w:sectPr>');
  });
});

describe('runs', () => {
  it('wraps text in a run and a paragraph', () => {
    const xml = xmlOf([{ type: 'paragraph', runs: [{ text: 'Hello' }] }]);
    expect(xml).toMatch(
      /<w:p><w:r><w:t xml:space="preserve">Hello<\/w:t><\/w:r><\/w:p>/,
    );
  });

  it('always sets xml:space="preserve"', () => {
    /*
     * Markdown puts meaningful single spaces at run boundaries constantly —
     * "**bold** and *italic*" is three runs whose middle one is " and ". Without
     * this a consumer is free to trim them and weld the words together.
     */
    const xml = xmlOf([{ type: 'paragraph', runs: [{ text: ' and ' }] }]);
    expect(xml).toContain('<w:t xml:space="preserve"> and </w:t>');
  });

  it.each([
    ['bold', '<w:b/>'],
    ['italic', '<w:i/>'],
    ['strike', '<w:strike/>'],
  ])('emits %s formatting', (key, expected) => {
    const xml = xmlOf([
      { type: 'paragraph', runs: [{ text: 'x', [key]: true }] },
    ]);
    expect(xml).toContain(expected);
  });

  it('gives code runs a monospace face', () => {
    const xml = xmlOf([
      { type: 'paragraph', runs: [{ text: 'npm', code: true }] },
    ]);
    expect(xml).toContain('w:ascii="Consolas"');
  });

  it('turns an embedded newline into a break, not a literal character', () => {
    const xml = xmlOf([{ type: 'paragraph', runs: [{ text: 'a\nb' }] }]);
    expect(xml).toContain('<w:br/>');
    expect(xml).not.toContain('a\nb');
  });
});

describe('xml escaping', () => {
  it('escapes the five reserved characters', () => {
    expect(xmlEscape(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&apos;');
  });

  it('produces well-formed xml for hostile text', () => {
    const xml = xmlOf([
      { type: 'paragraph', runs: [{ text: '</w:t></w:r><w:r>evil' }] },
    ]);
    expect(xml).not.toContain('<w:r>evil');
    expect(xml).toContain('&lt;/w:t&gt;');
  });

  it('drops control characters XML forbids outright', () => {
    // Not escapable — a raw one makes Word reject the package with a generic
    // "unreadable content" error that names no cause.
    const xml = xmlOf([
      {
        type: 'paragraph',
        runs: [
          { text: `a${String.fromCharCode(0)}${String.fromCharCode(7)}b` },
        ],
      },
    ]);
    expect(xml).toContain('ab');
    expect(xml).not.toContain(String.fromCharCode(0));
  });

  it('keeps tab and newline, which are legal', () => {
    expect(xmlEscape(`a${String.fromCharCode(9)}b`)).toContain(
      String.fromCharCode(9),
    );
  });
});

describe('headings', () => {
  it.each([1, 2, 3, 4, 5, 6])('maps h%i to its style', (level) => {
    const xml = xmlOf([{ type: 'heading', level, runs: [{ text: 'T' }] }]);
    expect(xml).toContain(`<w:pStyle w:val="Heading${level}"/>`);
  });

  it('clamps an out-of-range level into the styles that exist', () => {
    expect(xmlOf([{ type: 'heading', level: 9, runs: [] }])).toContain(
      'Heading6',
    );
  });
});

describe('hyperlinks', () => {
  it('registers a relationship and wraps the run', () => {
    const { documentXml, relationships } = build([
      {
        type: 'paragraph',
        runs: [{ text: 'docs', link: 'https://example.com' }],
      },
    ]);
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      target: 'https://example.com',
      external: true,
    });
    expect(documentXml).toContain(
      `<w:hyperlink r:id="${relationships[0].id}">`,
    );
    expect(documentXml).toContain('<w:rStyle w:val="Hyperlink"/>');
  });

  it('gives each link its own id', () => {
    const { relationships } = build([
      {
        type: 'paragraph',
        runs: [
          { text: 'a', link: 'https://a.test' },
          { text: 'b', link: 'https://b.test' },
        ],
      },
    ]);
    expect(new Set(relationships.map((r) => r.id)).size).toBe(2);
  });
});

describe('lists', () => {
  it('numbers bullets and ordered lists from different definitions', () => {
    const bullets = xmlOf([
      {
        type: 'list',
        ordered: false,
        items: [{ level: 0, runs: [{ text: 'a' }] }],
      },
    ]);
    const ordered = xmlOf([
      {
        type: 'list',
        ordered: true,
        items: [{ level: 0, runs: [{ text: 'a' }] }],
      },
    ]);
    expect(bullets).toContain('<w:numId w:val="1"/>');
    expect(ordered).toContain('<w:numId w:val="2"/>');
    expect(bullets).toContain('<w:pStyle w:val="ListParagraph"/>');
  });

  it('carries nesting depth as ilvl', () => {
    const xml = xmlOf([
      {
        type: 'list',
        ordered: false,
        items: [
          { level: 0, runs: [{ text: 'a' }] },
          { level: 2, runs: [{ text: 'c' }] },
        ],
      },
    ]);
    expect(xml).toContain('<w:ilvl w:val="0"/>');
    expect(xml).toContain('<w:ilvl w:val="2"/>');
  });

  it('clamps depth to the levels numbering.xml actually defines', () => {
    // A deeper ilvl than the definition has is not an error; it silently loses
    // its marker, which looks like a rendering bug.
    const xml = xmlOf([
      {
        type: 'list',
        ordered: false,
        items: [{ level: 7, runs: [{ text: 'x' }] }],
      },
    ]);
    expect(xml).toContain('<w:ilvl w:val="2"/>');
  });

  it('prefixes task items with a checkbox glyph', () => {
    const done = xmlOf([
      {
        type: 'list',
        items: [{ level: 0, checkbox: true, runs: [{ text: 'x' }] }],
      },
    ]);
    const todo = xmlOf([
      {
        type: 'list',
        items: [{ level: 0, checkbox: false, runs: [{ text: 'x' }] }],
      },
    ]);
    expect(done).toContain('☒');
    expect(todo).toContain('☐');
  });

  it('leaves a plain item unprefixed', () => {
    const xml = xmlOf([
      { type: 'list', items: [{ level: 0, runs: [{ text: 'x' }] }] },
    ]);
    expect(xml).not.toContain('☐');
    expect(xml).not.toContain('☒');
  });
});

describe('tables', () => {
  const table = {
    type: 'table',
    headers: [[{ text: 'H1' }], [{ text: 'H2' }]],
    rows: [[[{ text: 'a' }], [{ text: 'b' }]]],
  };

  it('emits a grid, borders and a repeating header row', () => {
    const xml = xmlOf([table]);
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:tblBorders>');
    // tblHeader repeats the row when the table spans a page break.
    expect(xml).toContain('<w:tblHeader/>');
    expect(xml.match(/<w:gridCol/g) ?? []).toHaveLength(2);
  });

  it('bolds header cells', () => {
    expect(xmlOf([table])).toMatch(/<w:tblHeader\/>[\s\S]*?<w:b\/>/);
  });

  it('pads a short row so the grid stays rectangular', () => {
    const xml = xmlOf([
      {
        type: 'table',
        headers: [[{ text: 'a' }], [{ text: 'b' }]],
        rows: [[[{ text: 'only' }]]],
      },
    ]);
    const lastRow = xml.slice(xml.lastIndexOf('<w:tr>'));
    expect(lastRow.match(/<w:tc>/g) ?? []).toHaveLength(2);
  });
});

describe('blockquotes and callouts', () => {
  it('styles a plain blockquote', () => {
    const xml = xmlOf([
      {
        type: 'blockquote',
        children: [{ type: 'paragraph', runs: [{ text: 'quoted' }] }],
      },
    ]);
    expect(xml).toContain('<w:pStyle w:val="Quote"/>');
    expect(xml).not.toContain('[');
  });

  it('prefixes a callout with its type', () => {
    const xml = xmlOf([
      {
        type: 'blockquote',
        calloutType: 'warning',
        children: [{ type: 'paragraph', runs: [{ text: 'careful' }] }],
      },
    ]);
    expect(xml).toContain('[WARNING]');
    expect(xml).toContain('careful');
  });

  it('keeps a callout title', () => {
    const xml = xmlOf([
      {
        type: 'blockquote',
        calloutType: 'note',
        calloutTitle: 'Heads up',
        children: [],
      },
    ]);
    expect(xml).toContain('[NOTE]');
    expect(xml).toContain('Heads up');
  });

  it('does not restyle a code block nested in a callout', () => {
    // Monospace silently becoming italic quote text would be worse than it
    // simply not being indented.
    const xml = xmlOf([
      {
        type: 'blockquote',
        calloutType: 'note',
        children: [{ type: 'code', content: 'x = 1' }],
      },
    ]);
    expect(xml).toContain('<w:pStyle w:val="Code"/>');
  });
});

describe('code blocks', () => {
  it('emits one styled paragraph per line', () => {
    const xml = xmlOf([{ type: 'code', content: 'a\nb\nc' }]);
    expect(xml.match(/<w:pStyle w:val="Code"\/>/g) ?? []).toHaveLength(3);
  });

  it('keeps blank lines', () => {
    const xml = xmlOf([{ type: 'code', content: 'a\n\nb' }]);
    expect(xml.match(/<w:pStyle w:val="Code"\/>/g) ?? []).toHaveLength(3);
  });

  it('escapes code content', () => {
    expect(xmlOf([{ type: 'code', content: 'if (a < b) {}' }])).toContain(
      'a &lt; b',
    );
  });
});

describe('images', () => {
  it('registers media and a relationship, and emits a drawing', () => {
    const { documentXml, relationships, mediaFiles } = build([
      { type: 'image', dataUri: PIXEL, alt: 'a diagram' },
    ]);
    expect(mediaFiles).toHaveLength(1);
    expect(mediaFiles[0][0]).toBe('image1.png');
    expect(mediaFiles[0][1]).toBeInstanceOf(Uint8Array);
    expect(relationships[0]).toMatchObject({
      target: 'media/image1.png',
      external: false,
    });
    expect(documentXml).toContain('<w:drawing>');
    expect(documentXml).toContain(`r:embed="${relationships[0].id}"`);
    expect(documentXml).toContain('descr="a diagram"');
  });

  it('sizes from the PNG header, preserving aspect ratio', () => {
    const { documentXml } = build([{ type: 'image', dataUri: WIDE, alt: '' }]);
    // 4x2 px at 9525 EMU per px.
    expect(documentXml).toContain('cx="38100" cy="19050"');
  });

  it('degrades a broken image to visible alt text instead of a corrupt part', () => {
    /*
     * A package that references a part it does not contain fails to open at all,
     * so a bad image must never reach mediaFiles.
     */
    const { documentXml, mediaFiles, relationships } = build([
      {
        type: 'image',
        dataUri: 'data:image/png;base64,bm90YXBuZw==',
        alt: 'x',
      },
    ]);
    expect(mediaFiles).toHaveLength(0);
    expect(relationships).toHaveLength(0);
    expect(documentXml).toContain('[image: x]');
  });

  it('numbers multiple images distinctly', () => {
    const { mediaFiles, documentXml } = build([
      { type: 'image', dataUri: PIXEL, alt: '' },
      { type: 'image', dataUri: WIDE, alt: '' },
    ]);
    expect(mediaFiles.map(([name]) => name)).toEqual([
      'image1.png',
      'image2.png',
    ]);
    // docPr ids must be unique and non-zero across the document.
    expect(documentXml).toContain('<wp:docPr id="1"');
    expect(documentXml).toContain('<wp:docPr id="2"');
  });
});

describe('pngDimensions', () => {
  it('reads the IHDR', () => {
    expect(pngDimensions(PIXEL)).toEqual({ width: 1, height: 1 });
    expect(pngDimensions(WIDE)).toEqual({ width: 4, height: 2 });
  });

  it('rejects anything that is not a PNG', () => {
    expect(() => pngDimensions('data:image/png;base64,bm90YXBuZw==')).toThrow();
    expect(() => pngDimensions('not-a-data-uri')).toThrow();
    expect(() => pngDimensionsFromBytes(new Uint8Array([1, 2, 3]))).toThrow();
  });
});

describe('horizontal rule', () => {
  it('is a bordered empty paragraph, since OOXML has no rule element', () => {
    expect(xmlOf([{ type: 'hr' }])).toContain('<w:pBdr>');
  });
});
