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
