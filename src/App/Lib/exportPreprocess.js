import { renderMermaidSVG } from './mermaidLoader.js';

/*
 * Markdown preprocessing for exports that consume markdown rather than HTML.
 *
 * Only DOCX needs this. HTML export post-processes *rendered* HTML — it swaps a
 * <pre><code class="language-mermaid"> element for inline SVG — while DOCX has
 * to hand markdown to a parser that has no idea what mermaid is, so the fence
 * must become an image before parsing. The two operate on different
 * representations and produce different artefacts (SVG vs raster PNG), so there
 * is nothing honest to share between them beyond the loader they both already
 * import.
 *
 * Callouts need no pass at all: markdown-it-container tokenises them, so the
 * DOCX parser reads `container_note_open` directly. That is strictly better than
 * rewriting them with a regex, which cannot tell a `:::note` inside a fenced
 * code block from a real one.
 */

/** Fenced mermaid blocks at the start of a line. */
const MERMAID_FENCE = /^```mermaid[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm;

/**
 * Rasterises an SVG string to a PNG data URI.
 *
 * Word cannot display SVG in the shape this writer emits, so diagrams have to
 * become bitmaps. Drawn at 2x and left at its natural size in the document, so
 * the image is not soft on a high-resolution screen or in print.
 */
export async function svgToPNG(svgString, { scale = 2 } = {}) {
  const sized = ensureIntrinsicSize(svgString);
  /*
   * A data: URL, not a blob: URL.
   *
   * Drawing an <img> whose source is a blob URL onto a canvas TAINTS it in
   * Chromium, and toDataURL then throws "Tainted canvases may not be exported".
   * The rendered diagram is generated in this very page, so the taint is
   * spurious — but the origin check does not care. A data: URL is treated as
   * same-origin and does not taint.
   *
   * encodeURIComponent rather than btoa: the SVG can contain any character the
   * diagram's labels contain, and btoa throws on anything above U+00FF.
   */
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized.svg)}`;

  try {
    const image = await loadImage(url);
    const width = image.naturalWidth || sized.width;
    const height = image.naturalHeight || sized.height;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    // Word composites onto white; a transparent diagram on a dark theme would
    // come out as dark strokes on white and be unreadable either way.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch (error) {
    throw new Error(`SVG could not be rasterised: ${error?.message ?? error}`);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('SVG failed to load'));
    image.src = url;
  });
}

/**
 * Gives the SVG a concrete pixel size.
 *
 * Mermaid emits `width="100%"` with a viewBox, which is right for a responsive
 * page and useless to a canvas: an <img> built from it reports naturalWidth 0
 * and drawImage produces a blank bitmap. The viewBox carries the real numbers,
 * so they are promoted onto the element.
 */
export function ensureIntrinsicSize(svgString) {
  const viewBox =
    /viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"/.exec(svgString);
  const width = viewBox ? Math.ceil(Number(viewBox[3])) : 800;
  const height = viewBox ? Math.ceil(Number(viewBox[4])) : 600;

  const svg = svgString
    .replace(/\swidth="[^"]*"/, '')
    .replace(/\sheight="[^"]*"/, '')
    .replace(/<svg\b/, `<svg width="${width}" height="${height}"`)
    // max-width in an inline style beats the width attribute in some renderers.
    .replace(/\sstyle="max-width:[^"]*"/, '');

  return { svg, width, height };
}

/**
 * Replaces every mermaid fence with an embedded PNG.
 *
 * A diagram that fails to render becomes italic placeholder text rather than
 * taking the export down — one bad diagram should not cost the document.
 */
export async function preprocessForExport(
  markdown,
  { theme = 'default' } = {},
) {
  const source = String(markdown ?? '');
  const matches = [...source.matchAll(MERMAID_FENCE)];
  const diagnostics = { diagrams: 0, failures: [] };
  if (matches.length === 0) return { markdown: source, diagnostics };

  const replacements = await Promise.all(
    matches.map(async (match, index) => {
      try {
        // Positional and namespaced, so two exports of one document produce
        // identical output.
        const svg = await renderMermaidSVG(
          match[1],
          `wp-docx-diagram-${index}`,
          theme,
        );
        const dataUri = await svgToPNG(svg);
        diagnostics.diagrams += 1;
        return { match: match[0], replacement: `![Diagram](${dataUri})` };
      } catch (error) {
        diagnostics.failures.push(error?.message ?? String(error));
        return {
          match: match[0],
          replacement: `*(Diagram could not be rendered)*`,
        };
      }
    }),
  );

  let out = source;
  for (const { match, replacement } of replacements) {
    // A function replacer, so `$&` and friends inside a base64 payload are not
    // treated as substitution patterns.
    out = out.replace(match, () => replacement);
  }
  return { markdown: out, diagnostics };
}
