/*
 * One mermaid instance, one fetch.
 *
 * Extracted from MermaidRenderer so the HTML and DOCX exporters can render
 * diagrams without mounting the component. The module-level promise is the whole
 * point: mermaid is a ~600 KB chunk plus per-diagram-type sub-chunks, and both
 * the live preview and an export must share the one download.
 */

let mermaidPromise = null;

export async function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default);
  }
  return mermaidPromise;
}

/** Maps a WaynePDF theme to the closest mermaid built-in. */
export function mermaidTheme(resolvedTheme) {
  switch (resolvedTheme) {
    case 'dark':
      return 'dark';
    case 'sepia':
      return 'neutral';
    // Mermaid has no high-contrast theme; neutral has the strongest strokes of
    // the four and is the least-bad fit.
    case 'high-contrast':
      return 'neutral';
    default:
      return 'default';
  }
}

/**
 * Renders one diagram to an SVG string, off-document.
 *
 * `id` must be supplied by the caller and be unique within the page — mermaid
 * derives every internal id in the SVG from it, and reusing one produces two
 * diagrams whose markers and clip paths collide.
 */
export async function renderMermaidSVG(source, id, theme = 'default') {
  const mermaid = await loadMermaid();
  mermaid.initialize({
    startOnLoad: false,
    theme: mermaidTheme(theme),
    // Diagram source is document content, exactly as untrusted as the rest.
    securityLevel: 'strict',
  });
  try {
    const { svg } = await mermaid.render(id, source);
    return svg;
  } finally {
    /*
     * mermaid leaves an orphaned full-height measurement node in <body> when a
     * render fails. Cleaned up here as well as in MermaidRenderer, because an
     * export can render diagrams without the component ever mounting.
     */
    document.getElementById(`d${id}`)?.remove();
  }
}

/* ----------------------------------------------------------- HTML-string pass */

/** A rendered mermaid fence, as markdown-it's highlight hook emits it. */
const MERMAID_BLOCK =
  /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/**
 * markdown-it escapes the diagram source into HTML entities; mermaid needs the
 * raw text back. A detached <textarea> is the standard entity decoder.
 */
function decodeEntities(html) {
  if (typeof document === 'undefined') return html;
  const el = document.createElement('textarea');
  el.innerHTML = html;
  return el.value;
}

/**
 * Swaps every `<pre><code class="language-mermaid">` block in a rendered HTML
 * string for its inline SVG.
 *
 * This is the one place the live preview, the HTML export and the PDF
 * pagination path all reach for: markdown-it leaves mermaid fences as code
 * blocks (it has no idea what mermaid is), and whoever consumes that HTML has to
 * turn them into diagrams. Pulling it here means the paginated/printed output
 * renders diagrams exactly the way the HTML export already did, rather than
 * printing the diagram source as a code block.
 *
 * A diagram that fails to parse becomes a visible error block rather than taking
 * the whole document down — the same choice the live renderer makes.
 *
 * `idPrefix` must be unique per call site and is made positional per block, so
 * two renders of one document produce identical, non-colliding SVG ids.
 */
export async function renderMermaidInHTML(
  html,
  { theme = 'default', idPrefix = 'wp-diagram' } = {},
) {
  const source = String(html ?? '');
  const blocks = [...source.matchAll(MERMAID_BLOCK)];
  if (blocks.length === 0) return source;

  const rendered = await Promise.all(
    blocks.map(async (match, index) => {
      const diagramSource = decodeEntities(match[1]);
      try {
        const svg = await renderMermaidSVG(
          diagramSource,
          `${idPrefix}-${index}`,
          theme,
        );
        return {
          match: match[0],
          html: `<div class="mermaid-diagram">${svg}</div>`,
        };
      } catch (error) {
        return {
          match: match[0],
          html: `<pre class="mermaid-error">Mermaid error: ${escapeHtml(
            error?.message ?? error,
          )}\n\n${escapeHtml(diagramSource)}</pre>`,
        };
      }
    }),
  );

  let out = source;
  for (const { match, html: replacement } of rendered) {
    // A function replacer, so `$&` and friends inside the SVG payload are not
    // treated as substitution patterns.
    out = out.replace(match, () => replacement);
  }
  return out;
}
