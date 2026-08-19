import styled from 'styled-components';
import { Provider, useProvided } from 'nonaction';
import { Header, Markdown } from './Components';
import Toast from './Components/Toast.jsx';
import MathCopyButton from './Components/Previewer/MathCopyButton.jsx';
import LayoutStyles from './Components/LayoutStyles.jsx';
import FrontmatterWatcher from './Components/FrontmatterWatcher.jsx';
import {
  TextContainer,
  ThemeContainer,
  LanguageContainer,
  EncodingBannerContainer,
  LayoutContainer,
  PageCountContainer,
  CustomThemesContainer,
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
          CustomThemesContainer,
        ]}
      >
        <LayoutStyles />
        <FrontmatterWatcher />
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
  font-family: var(--wp-font-family-ui);
  @media print {
    /*
     * Only the shell itself. This used to read "&, div", ported from upstream
     * to flatten the flex layout for Firefox — but styled-components scopes it
     * to *every* div in the app, and paged.js builds its page geometry out of
     * nested divs. .pagedjs_sheet and .pagedjs_pagebox are CSS grids whose
     * columns ARE the page margins, so forcing them to display:block dropped
     * every margin and printed the text flush to the paper edge.
     *
     * The wrappers that genuinely need flattening are listed by name in
     * styles/markdown/print.css instead.
     */
    & {
      display: block;
      height: auto;
    }
    .no-print,
    .no-print * {
      display: none !important;
    }
  }
`;
