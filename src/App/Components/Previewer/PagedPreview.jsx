import { useMemo } from 'react';
import { renderDocument } from './Preview.jsx';
import Paginator from './Paginator.jsx';

/**
 * Paged-mode entry point.
 *
 * Sits between Previewer and Paginator so the markdown-it instance stays inside
 * the lazily-loaded Preview chunk. Importing `md` from Previewer/index.jsx
 * directly would drag highlight.js and KaTeX into the main bundle and undo the
 * code-splitting from Phases 3.5 and 4.
 */
export default function PagedPreview({
  source,
  layout,
  theme,
  sanitizeHtml = false,
  onPagesReady,
}) {
  // Same renderer as the flowing preview, so paginated output cannot drift from
  // what the user was looking at before switching modes.
  const html = useMemo(
    () => renderDocument(source, { sanitizeHtml }).html,
    [source, sanitizeHtml],
  );
  return (
    <Paginator
      sourceHtml={html}
      layout={layout}
      theme={theme}
      onPagesReady={onPagesReady}
    />
  );
}
