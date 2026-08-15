import { Suspense, lazy } from 'react';
import styled from 'styled-components';
import { useProvided } from 'nonaction';
import Loading from '../Loading.jsx';
import ErrorBoundary from '../ErrorBoundary.jsx';
import { LanguageContainer } from '../../Container';

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

const LazyPreview = lazy(() => import('./Preview.jsx'));

export default function Previewer({ children }) {
  const [{ resolvedLang, resolvedDirection }] = useProvided(LanguageContainer);

  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading duration={0.5} />}>
        <Wrapper
          className="preview markdown-body"
          // `und` means we could not tell. Omitting lang entirely is honest and
          // lets the browser fall back; asserting lang="und" would suppress the
          // per-language font stacks for no gain.
          lang={resolvedLang === 'und' ? undefined : resolvedLang}
          dir={resolvedDirection}
        >
          <LazyPreview>{children}</LazyPreview>
        </Wrapper>
      </Suspense>
    </ErrorBoundary>
  );
}
