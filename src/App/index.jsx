import styled from 'styled-components';
import { Provider, useProvided } from 'nonaction';
import { Header, Markdown } from './Components';
import Toast from './Components/Toast.jsx';
import MathCopyButton from './Components/Previewer/MathCopyButton.jsx';
import LayoutStyles from './Components/LayoutStyles.jsx';
import {
  TextContainer,
  ThemeContainer,
  LanguageContainer,
  EncodingBannerContainer,
  LayoutContainer,
  PageCountContainer,
} from './Container';

/** Bridges the page count from PageCountContainer into the Header. */
const HeaderWithPageCount = () => {
  const [pageCount] = useProvided(PageCountContainer);
  return <Header pageCount={pageCount} />;
};

const App = ({ className }) => {
  return (
    <div className={className} id="waynepdf-app">
      <Provider
        inject={[
          TextContainer,
          ThemeContainer,
          LanguageContainer,
          EncodingBannerContainer,
          LayoutContainer,
          PageCountContainer,
        ]}
      >
        <LayoutStyles />
        <HeaderWithPageCount />
        <Markdown />
        {/* Both are chrome, not document: they portal/fix outside the flow and
            carry no-print, so they never reach the PDF. */}
        <MathCopyButton />
        <Toast />
      </Provider>
    </div>
  );
};

export default styled(App)`
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: var(--wp-font-family-sans);
  @media print {
    &,
    div {
      display: block;
      height: auto;
      /* Reset to normalize for FireFox */
    }
    .no-print,
    .no-print * {
      display: none !important;
    }
  }
`;
