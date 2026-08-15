import { Suspense, lazy } from 'react';
import styled from 'styled-components';
import Loading from '../Loading.jsx';
import ErrorBoundary from '../ErrorBoundary.jsx';

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
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading duration={0.5} />}>
        <Wrapper className="preview markdown-body">
          <LazyPreview>{children}</LazyPreview>
        </Wrapper>
      </Suspense>
    </ErrorBoundary>
  );
}
