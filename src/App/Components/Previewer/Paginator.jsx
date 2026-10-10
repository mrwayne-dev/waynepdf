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

/** Breathing room either side of the sheet, matching the output's padding. */
const FIT_GUTTER_PX = 32;

export default function Paginator({ sourceHtml, layout, theme, onPagesReady }) {
  const targetRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [pages, setPages] = useState(0);
  /*
   * The sheet's width at zoom 1, measured once per pagination.
   *
   * Kept rather than re-measured on every resize because reading it back while
   * the fit is applied returns the *scaled* width, and feeding that into the
   * next ratio shrinks the page a little further on every resize tick.
   */
  const sheetWidthRef = useRef(0);

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
          /*
           * Clear any fit from the previous run before fragmenting. paged.js
           * measures the boxes it creates, so a scale left in place here would
           * have it fragmenting against a page it thinks is 586px wide — every
           * break would land in the wrong place.
           */
          target.style.removeProperty('--wp-page-fit');
          target.style.removeProperty('--wp-page-w');
          target.style.removeProperty('--wp-page-h');
          sheetWidthRef.current = 0;
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

  /*
   * Fit the sheet to the pane.
   *
   * An A4 page is 794px at 96dpi and the preview pane is narrower than that at
   * any normal window size once the 260px sidebar is out — so the sheet
   * overflowed. Worse, `align-items: center` on an overflowing flex item spills
   * it equally both ways, and the left half of that overflow cannot be scrolled
   * to: the first character of every line was simply unreachable.
   *
   * Applied only once status is 'ready', never during fragmentation, and scoped
   * to screen in CSS so paper still gets a 1:1 page.
   *
   * The sheet's own dimensions go out alongside the ratio because the CSS
   * compensates the layout box with negative margins, and it needs the real
   * numbers to do that — a transform shrinks what you see and nothing else.
   */
  useEffect(() => {
    if (status !== 'ready') return undefined;
    const target = targetRef.current;
    if (!target) return undefined;

    const measure = () => {
      const sheet = target.querySelector('.pagedjs_page');
      if (!sheet) return;

      if (!sheetWidthRef.current) {
        // First pass after this pagination: nothing is scaled yet, so the rect
        // is the sheet's true size.
        const rect = sheet.getBoundingClientRect();
        sheetWidthRef.current = rect.width;
        target.style.setProperty('--wp-page-w', `${rect.width}px`);
        target.style.setProperty('--wp-page-h', `${rect.height}px`);
      }
      const sheetWidth = sheetWidthRef.current;
      if (!sheetWidth) return;

      const available = target.clientWidth - FIT_GUTTER_PX;
      // Never scale up: a page smaller than the pane sits at its real size.
      const next = Math.min(1, available / sheetWidth);
      if (!Number.isFinite(next) || next <= 0) return;

      const current = Number(
        target.style.getPropertyValue('--wp-page-fit') || 1,
      );
      // A threshold, because applying the fit can add or remove the vertical
      // scrollbar, which changes clientWidth and wakes the observer again.
      if (Math.abs(next - current) < 0.005) return;
      target.style.setProperty('--wp-page-fit', String(next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [status, pages, layout]);

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
