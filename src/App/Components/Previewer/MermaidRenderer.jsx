import { useEffect, useState } from 'react';
import LazyLoad from '../LazyLoad.jsx';
import { loadMermaid, mermaidTheme } from '../../Lib/mermaidLoader.js';

/*
 * Mermaid diagrams.
 *
 * A post-render DOM pass rather than a markdown-it plugin: mermaid's render is
 * asynchronous and produces SVG, and markdown-it's renderer contract is
 * synchronous and string-based. Rewriting the DOM after the fact is the seam
 * that actually fits.
 *
 * The loader and the theme map moved to Lib/mermaidLoader.js in 6d.1 so the
 * exporters can render diagrams without mounting this component, sharing the one
 * module-level promise rather than fetching the chunk twice.
 */

const SELECTOR = 'pre > code.language-mermaid';

export default function MermaidRenderer({ containerRef, html, theme }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const root = containerRef?.current;
    if (!root) return undefined;

    const blocks = [...root.querySelectorAll(SELECTOR)];
    if (blocks.length === 0) {
      /*
       * Clearing rather than returning bare. The effect re-runs on every render,
       * so a document that *had* a diagram and no longer does would otherwise
       * leave `loading` stuck true from the previous pass — the badge would sit
       * on screen forever, and anything waiting for it to clear (the paged
       * tests' settle check, for one) would hang.
       */
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const mermaid = await loadMermaid();
        if (cancelled) return;
        /*
         * securityLevel 'strict' disables mermaid's own HTML-in-label support.
         * Diagram source is document content, so it is exactly as untrusted as
         * the rest of the document.
         */
        mermaid.initialize({
          startOnLoad: false,
          theme: mermaidTheme(theme),
          securityLevel: 'strict',
        });
        setLoading(false);

        for (const [i, block] of blocks.entries()) {
          if (cancelled) return;
          // The block may already have been replaced by a previous run.
          if (!block.isConnected) continue;
          const source = block.textContent ?? '';
          const id = `wp-mermaid-${Date.now()}-${i}`;
          try {
            const { svg } = await mermaid.render(id, source);
            if (cancelled) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'mermaid-diagram';
            wrapper.innerHTML = svg;
            block.parentElement?.replaceWith(wrapper);
          } catch (err) {
            if (cancelled) return;
            // Source stays visible so the user can see what failed — the same
            // choice KaTeX errors make in Phase 4.
            const node = document.createElement('pre');
            node.className = 'mermaid-error';
            node.textContent = `Mermaid error: ${err?.message ?? err}\n\n${source}`;
            block.parentElement?.replaceWith(node);
            /*
             * mermaid leaves an orphaned measurement node in <body> when a
             * diagram fails to parse. Without this the DOM accumulates one per
             * failed render, and each is a full-height invisible div.
             */
            document.getElementById(`d${id}`)?.remove();
          }
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `html` is the trigger: the DOM has been rewritten, so re-scan for blocks.
    // Theme is a dependency because a theme change must re-render every diagram.
  }, [containerRef, html, theme]);

  if (!loading) return null;
  return (
    <div className="wp-mermaid-loading">
      <LazyLoad label="Loading diagram engine" estimatedKb={280} />
    </div>
  );
}
