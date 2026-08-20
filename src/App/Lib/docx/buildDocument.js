import { xmlEscape } from './xmlEscape.js';
import { dataUriToBytes, pngDimensionsFromBytes } from './pngDimensions.js';
import {
  BULLET_NUM_ID,
  ORDERED_NUM_ID,
  MAX_LIST_LEVEL,
} from './templates/numbering.js';

/*
 * IR to word/document.xml.
 *
 * Everything here is string concatenation, which is the right tool: OOXML is
 * verbose, deeply nested, and entirely static in shape. A DOM builder would add
 * a dependency and obscure the one thing that matters, which is that the emitted
 * element order matches the schema — Word validates sequence, not just names.
 */

/** 914400 EMU to the inch; 96 CSS px to the inch. */
const EMU_PER_PIXEL = 9525;
/** Letter width minus one-inch margins. */
const MAX_IMAGE_WIDTH_PX = 6 * 96;

const CALLOUT_LABELS = {
  note: 'NOTE',
  tip: 'TIP',
  warning: 'WARNING',
  danger: 'DANGER',
  info: 'INFO',
};

const CHECKBOX_CHECKED = '☒';
const CHECKBOX_EMPTY = '☐';

export function buildDocument(blocks) {
  const context = {
    relationships: [],
    mediaFiles: [],
    nextRelId: 1,
    nextImage: 1,
  };

  const body = (blocks ?? [])
    .map((block) => renderBlock(block, context))
    .join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  return {
    documentXml,
    relationships: context.relationships,
    mediaFiles: context.mediaFiles,
  };
}

function renderBlock(block, context, options = {}) {
  switch (block?.type) {
    case 'paragraph':
      return renderParagraph(block.runs, context, options);
    case 'heading':
      return renderParagraph(block.runs, context, {
        style: `Heading${Math.min(Math.max(block.level, 1), 6)}`,
      });
    case 'list':
      return renderList(block, context);
    case 'table':
      return renderTable(block, context);
    case 'blockquote':
      return renderBlockquote(block, context);
    case 'code':
      return renderCode(block);
    case 'image':
      return renderImage(block, context);
    case 'hr':
      return renderHorizontalRule();
    default:
      return '';
  }
}

/* ------------------------------------------------------------------- runs */

function renderRun(run) {
  const properties = [];
  if (run.bold) properties.push('<w:b/>');
  if (run.italic) properties.push('<w:i/>');
  if (run.strike) properties.push('<w:strike/>');
  if (run.code) {
    properties.push(
      '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="18"/><w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/>',
    );
  }
  if (run.link) properties.push('<w:rStyle w:val="Hyperlink"/>');
  const rPr = properties.length ? `<w:rPr>${properties.join('')}</w:rPr>` : '';

  /*
   * xml:space="preserve" on every run.
   *
   * Without it a consumer is free to collapse leading and trailing whitespace,
   * and markdown puts meaningful single spaces at run boundaries all the time —
   * "**bold** and *italic*" is three runs whose middle one is " and ".
   * Dropping those spaces welds the words together.
   */
  const text = splitOnNewlines(run.text ?? '');
  return `<w:r>${rPr}${text}</w:r>`;
}

/** A literal newline inside a run is a soft break, not a character. */
function splitOnNewlines(text) {
  return text
    .split('\n')
    .map((part) => `<w:t xml:space="preserve">${xmlEscape(part)}</w:t>`)
    .join('<w:br/>');
}

function renderRuns(runs, context) {
  return (runs ?? [])
    .map((run) => {
      if (!run.link) return renderRun(run);
      const id = `rId${context.nextRelId++}`;
      context.relationships.push({
        id,
        target: run.link,
        external: true,
      });
      return `<w:hyperlink r:id="${id}">${renderRun(run)}</w:hyperlink>`;
    })
    .join('');
}

/* -------------------------------------------------------------- paragraph */

function renderParagraph(runs, context, { style, extraPPr = '' } = {}) {
  const parts = [];
  if (style) parts.push(`<w:pStyle w:val="${style}"/>`);
  if (extraPPr) parts.push(extraPPr);
  const pPr = parts.length ? `<w:pPr>${parts.join('')}</w:pPr>` : '';
  return `<w:p>${pPr}${renderRuns(runs, context)}</w:p>`;
}

/* ------------------------------------------------------------------ lists */

function renderList(block, context) {
  const numId = block.ordered ? ORDERED_NUM_ID : BULLET_NUM_ID;
  return (block.items ?? [])
    .map((item) => {
      const level = Math.min(item.level ?? 0, MAX_LIST_LEVEL);
      const numPr = `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>`;
      /*
       * Task list items are a checkbox glyph plus a space, prefixed to the text.
       * The real OOXML checkbox is a content control (w:sdt) with a Word-specific
       * form field inside; LibreOffice renders those as empty boxes, and neither
       * app lets you tick one in a document generated this way. A glyph is what
       * both actually show.
       */
      const runs =
        item.checkbox === undefined
          ? item.runs
          : [
              {
                text: `${item.checkbox ? CHECKBOX_CHECKED : CHECKBOX_EMPTY} `,
              },
              ...(item.runs ?? []),
            ];
      return renderParagraph(runs, context, {
        style: 'ListParagraph',
        extraPPr: numPr,
      });
    })
    .join('');
}

/* ----------------------------------------------------------------- tables */

const CELL_WIDTH_TWIPS = (columns) => Math.floor(9360 / Math.max(columns, 1));

function renderCell(runs, context, { header = false, width } = {}) {
  const shading = header
    ? '<w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/>'
    : '';
  const cellRuns = header
    ? (runs ?? []).map((run) => ({ ...run, bold: true }))
    : runs;
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}</w:tcPr>${renderParagraph(cellRuns, context)}</w:tc>`;
}

function renderTable(block, context) {
  const columns = Math.max(
    block.headers?.length ?? 0,
    ...(block.rows ?? []).map((row) => row.length),
    1,
  );
  const width = CELL_WIDTH_TWIPS(columns);

  const border = (side) =>
    `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`;
  const borders = `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders>`;

  const rows = [];
  if (block.headers?.length) {
    const cells = block.headers
      .map((runs) => renderCell(runs, context, { header: true, width }))
      .join('');
    // tblHeader repeats the row when the table spans a page break.
    rows.push(`<w:tr><w:trPr><w:tblHeader/></w:trPr>${cells}</w:tr>`);
  }
  for (const row of block.rows ?? []) {
    const cells = Array.from({ length: columns }, (_, index) =>
      renderCell(row[index] ?? [], context, { width }),
    ).join('');
    rows.push(`<w:tr>${cells}</w:tr>`);
  }

  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${borders}</w:tblPr><w:tblGrid>${Array.from(
    { length: columns },
    () => `<w:gridCol w:w="${width}"/>`,
  ).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
}

/* ------------------------------------------------------------ blockquotes */

function renderBlockquote(block, context) {
  const label = CALLOUT_LABELS[block.calloutType];
  const children = block.children ?? [];

  const heading = label
    ? renderParagraph(
        [
          { text: `[${label}]`, bold: true },
          ...(block.calloutTitle ? [{ text: ` ${block.calloutTitle}` }] : []),
        ],
        context,
        { style: 'Quote' },
      )
    : '';

  /*
   * Nested blocks are re-rendered with the Quote style rather than being
   * indented by hand. Anything that is not a paragraph — a code block or a table
   * inside a callout — keeps its own style, because a monospace block that
   * silently became italic quote text would be worse than one that is not
   * indented.
   */
  const body = children
    .map((child) =>
      child.type === 'paragraph'
        ? renderParagraph(child.runs, context, { style: 'Quote' })
        : renderBlock(child, context),
    )
    .join('');

  return `${heading}${body}`;
}

/* ------------------------------------------------------------------- code */

function renderCode(block) {
  const lines = String(block.content ?? '').split('\n');
  /*
   * One paragraph per line: a single paragraph with w:br between lines wraps
   * differently and loses the shaded background on the empty ones.
   *
   * The last line closes the block explicitly. The Code style sets
   * contextualSpacing so consecutive lines sit flush, which is right inside a
   * listing and wrong at its end — two adjacent code blocks rendered as one
   * unbroken slab, and the paragraph after a block butted straight against it.
   */
  return lines
    .map((line, index) => {
      /*
       * Both ends, not just the last line. contextualSpacing means "ignore
       * spacing above and below between paragraphs sharing a style", so it has
       * to be off on BOTH sides of a boundary to open a gap: cancelling it only
       * after a block's last line still left the next block's first line
       * suppressing the space above itself, and two adjacent listings rendered
       * as one unbroken slab.
       */
      const first = index === 0;
      const last = index === lines.length - 1;
      const spacing =
        first || last
          ? `<w:contextualSpacing w:val="0"/><w:spacing w:before="${first ? 120 : 0}" w:after="${last ? 240 : 0}"/>`
          : '';
      return `<w:p><w:pPr><w:pStyle w:val="Code"/>${spacing}</w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`;
    })
    .join('');
}

/* ------------------------------------------------------------------ image */

function renderImage(block, context) {
  let bytes;
  let size;
  try {
    bytes = dataUriToBytes(block.dataUri);
    size = pngDimensionsFromBytes(bytes);
  } catch {
    /*
     * A remote or malformed image cannot be embedded, and a package that
     * references a part it does not contain fails to open at all. The alt text
     * is a visible, honest degradation.
     */
    return renderParagraph(
      [{ text: block.alt ? `[image: ${block.alt}]` : '[image]', italic: true }],
      context,
    );
  }

  // Captured before incrementing: the same ordinal names the part and numbers
  // the drawing, and reading the counter afterwards started both at 2.
  const ordinal = context.nextImage++;
  const name = `image${ordinal}.png`;
  const id = `rId${context.nextRelId++}`;
  context.mediaFiles.push([name, bytes]);
  context.relationships.push({ id, target: `media/${name}`, external: false });

  const scale = Math.min(1, MAX_IMAGE_WIDTH_PX / size.width);
  const widthEmu = Math.round(size.width * scale * EMU_PER_PIXEL);
  const heightEmu = Math.round(size.height * scale * EMU_PER_PIXEL);
  const alt = xmlEscape(block.alt ?? '');
  // docPr ids must be unique across the document and non-zero.
  const docPrId = ordinal;

  return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="Picture ${docPrId}" descr="${alt}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${name}" descr="${alt}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

/* --------------------------------------------------------------------- hr */

function renderHorizontalRule() {
  // A bottom border on an empty paragraph. OOXML has no rule element.
  return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BFBFBF"/></w:pBdr></w:pPr></w:p>';
}
