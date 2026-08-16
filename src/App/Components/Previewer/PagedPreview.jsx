import { useMemo } from 'react';
import { md } from './Preview.jsx';
import Paginator from './Paginator.jsx';

/**
 * Paged-mode entry point.
 *
 * Sits between Previewer and Paginator so the markdown-it instance stays inside
 * the lazily-loaded Preview chunk. Importing `md` from Previewer/index.jsx
 * directly would drag highlight.js and KaTeX into the main bundle and undo the
 * code-splitting from Phases 3.5 and 4.
 */
export default function PagedPreview({ source, layout, onPagesReady }) {
  const html = useMemo(() => md.render(source ?? ''), [source]);
  return (
    <Paginator sourceHtml={html} layout={layout} onPagesReady={onPagesReady} />
  );
}
