import { Suspense, lazy } from 'react';
import styled from 'styled-components';
import { useProvided } from 'nonaction';
import Loading from '../Loading.jsx';
import ErrorBoundary from '../ErrorBoundary.jsx';
import {
  LanguageContainer,
  LayoutContainer,
  ThemeContainer,
} from '../../Container';

const Wrapper = styled.div`
  overflow-y: scroll;
  -webkit-overflow-scrolling: touch;
  width: 100%;
  /*
   * The measure is capped at 800px and centred in the pane.
   *
   * This div IS the .markdown-body, so the cap goes on the element itself and
   * the surplus shows the app canvas behind it — which is the same colour in
   * every theme (app.css paints body with --wp-color-canvas), so the seam is
   * invisible rather than a visible column.
   *
   * Percentage padding was the obvious alternative and is wrong here: a
   * percentage resolves against the containing block, which for this flex item
   * is the full split row, not the pane it gets shrunk into. On a 1600px window
   * that computed 400px of padding onto an 800px pane and collapsed the text to
   * one character per line.
   */
  box-sizing: border-box;
  max-width: calc(800px + var(--wp-space-8) * 2);
  margin-inline: auto;
  padding: var(--wp-space-6) var(--wp-space-8);
  @media (max-width: 900px) {
    padding: var(--wp-space-4);
  }
  @media print {
    padding: 0;
    overflow-y: hidden;
  }
`;

const PagedWrapper = styled.div`
  width: 100%;
  overflow: hidden;
  @media print {
    overflow: visible;
  }
`;

const LazyPreview = lazy(() => import('./Preview.jsx'));
// Separate chunk from Preview so paged.js is not paid for in Flowing mode.
const LazyPagedPreview = lazy(() => import('./PagedPreview.jsx'));

export default function Previewer({ children, onPagesReady }) {
  const [{ resolvedLang, resolvedDirection }] = useProvided(LanguageContainer);
  const [layout] = useProvided(LayoutContainer);
  const [themeSettings] = useProvided(ThemeContainer);
  const sanitizeHtml = themeSettings.sanitizeHtml === true;
  const isPaged = layout.previewMode === 'paged';

  /*
   * lang and dir stay on the wrapper in both modes. In paged mode the wrapper
   * is an ancestor of every .pagedjs_page, so the per-language font stacks and
   * RTL rules from Phase 3 still inherit into the fragmented output.
   */
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading duration={0.5} />}>
        {isPaged ? (
          <PagedWrapper
            className="preview markdown-body preview-paged"
            lang={resolvedLang === 'und' ? undefined : resolvedLang}
            dir={resolvedDirection}
          >
            <LazyPagedPreview
              source={children}
              layout={layout}
              theme={themeSettings.resolvedTheme}
              sanitizeHtml={sanitizeHtml}
              onPagesReady={onPagesReady}
            />
          </PagedWrapper>
        ) : (
          <Wrapper
            className="preview markdown-body flowing-preview"
            // `und` means we could not tell. Omitting lang entirely is honest
            // and lets the browser fall back; asserting lang="und" would
            // suppress the per-language font stacks for no gain.
            lang={resolvedLang === 'und' ? undefined : resolvedLang}
            dir={resolvedDirection}
          >
            <LazyPreview
              sanitizeHtml={sanitizeHtml}
              theme={themeSettings.resolvedTheme}
            >
              {children}
            </LazyPreview>
          </Wrapper>
        )}
      </Suspense>
    </ErrorBoundary>
  );
}
