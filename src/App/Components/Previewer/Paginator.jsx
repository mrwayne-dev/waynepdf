import { useEffect, useRef, useState } from 'react';
import { preprocess } from '../../Lib/paginatorPreprocess.js';
import { generateLayoutCSS } from '../../Lib/generateLayoutCSS.js';
import { renderMermaidInHTML } from '../../Lib/mermaidLoader.js';
import LazyLoad from '../LazyLoad.jsx';
import './paginator.css';

/*
 * Live paginated preview.
 *
 * paged.js re-fragments the entire document on every run, which is 1-3s for a
 * long file. That cost is why pagination is a mode rather than something the
 * preview always does, and why this component debounces.
 */

/** Long enough that typing a sentence triggers one run, not twenty. */
export const PAGINATE_DEBOUNCE_MS = 800;

/**
 * Fragments `sourceHtml` into `target`.
 *
 * Exported so the Transform flow can paginate on demand without mounting this
 * component — the two paths must produce byte-identical output, so they share
 * one implementation rather than two that drift.
 *
 * The layout CSS is handed to paged.js explicitly rather than left in the
 * document: browsers ignore @top-center, string-set and target-counter, so
 * only paged.js's own Polisher can act on them. Passing an empty array here
 * would silently produce unstyled pages with no headers or footers.
 *
 * Mermaid fences are rendered to SVG *before* pagination. markdown-it leaves
 * them as `<pre><code class="language-mermaid">` code blocks, and paged.js would
 * otherwise fragment the diagram source as a code listing — which is exactly why
 * diagrams never appeared in the printed PDF. Doing it here covers both routes
 * that print: the live Paged preview and the Flowing-mode Transform target.
 */
export async function paginateInto(sourceHtml, layout, target, { theme } = {}) {
  const { Previewer } = await import('pagedjs');
  const withDiagrams = await renderMermaidInHTML(sourceHtml, {
    theme,
    idPrefix: 'wp-paged-diagram',
  });
  const previewer = new Previewer();
  const content = preprocess(withDiagrams, layout);
  const css = generateLayoutCSS(layout);
  const started = performance.now();
  const flow = await previewer.preview(
    content,
    [{ 'wp-layout.css': css }],
    target,
  );
  return { flow, elapsed: performance.now() - started };
}

export default function Paginator({ sourceHtml, layout, theme, onPagesReady }) {
  const targetRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [pages, setPages] = useState(0);

  useEffect(() => {
    /*
     * StrictMode double-invokes effects and a run can outlive its effect, so
     * every async step re-checks this flag. Without it a torn-down instance
     * keeps writing pages into a target the next instance has already claimed,
     * and the preview ends up with two copies of the document.
     */
    let cancelled = false;
    const target = targetRef.current;
    if (!target) return undefined;

    const timer = setTimeout(() => {
      setStatus('rendering');
      (async () => {
        try {
          // paged.js has no cancel API; clearing the target is what makes a
          // superseded run harmless.
          target.innerHTML = '';
          const { flow } = await paginateInto(sourceHtml, layout, target, {
            theme,
          });
          if (cancelled) return;
          setPages(flow.total);
          setStatus('ready');
          onPagesReady?.(flow.total);
        } catch (error) {
          if (cancelled) return;
          console.error('Pagination failed:', error);
          setStatus('error');
        }
      })();
    }, PAGINATE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sourceHtml, layout, theme, onPagesReady]);

  return (
    <div className="paginator">
      {/* The module fetch carries a size estimate; pagination is pure compute,
          so quoting a download figure for it would be a lie. */}
      {status === 'loading' && (
        <LazyLoad label="Loading paginator" estimatedKb={101} />
      )}
      {status === 'rendering' && <LazyLoad label="Paginating" />}
      {status === 'error' && (
        <div
          className="paginator-status no-print is-error"
          role="status"
          aria-live="polite"
        >
          Pagination failed — see the console.
        </div>
      )}
      {/*
       * The page count, which lived in the header until 7.2 cut that bar down
       * to controls scoped to the document rather than to the preview. It only
       * ever appeared in Paged mode, so it belongs to the paginated view — and
       * this is where someone counting pages is already looking.
       */}
      {status === 'ready' && pages > 0 && (
        <p className="paginator-count no-print" aria-live="polite">
          {pages} {pages === 1 ? 'page' : 'pages'}
        </p>
      )}
      <div
        ref={targetRef}
        className="paginator-output"
        data-page-count={pages}
      />
    </div>
  );
}
