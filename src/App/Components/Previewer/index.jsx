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
  padding: 10px;
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
