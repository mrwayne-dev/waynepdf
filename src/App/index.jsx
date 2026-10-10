import styled from 'styled-components';
import { Provider } from 'nonaction';
import Sidebar from './Components/Sidebar/index.jsx';
import Workspace from './Components/Workspace.jsx';
import Toast from './Components/Toast.jsx';
import MathCopyButton from './Components/Previewer/MathCopyButton.jsx';
import LayoutStyles from './Components/LayoutStyles.jsx';
import FrontmatterWatcher from './Components/FrontmatterWatcher.jsx';
import PreferencesWindow from './Components/Preferences/index.jsx';
import KeyboardShortcuts from './Components/KeyboardShortcuts.jsx';
import {
  TextContainer,
  ThemeContainer,
  LanguageContainer,
  EncodingBannerContainer,
  LayoutContainer,
  PageCountContainer,
  CustomThemesContainer,
  ExportFormatContainer,
  PreferencesContainer,
} from './Container';

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
          ExportFormatContainer,
          PreferencesContainer,
        ]}
      >
        <LayoutStyles />
        <FrontmatterWatcher />
        {/* A flex row: the sidebar is chrome that spans the full height, and
            the workspace is everything the document owns. */}
        <div className="wp-shell">
          <Sidebar />
          <Workspace />
        </div>
        {/* Both are chrome, not document: they portal/fix outside the flow and
            carry no-print, so they never reach the PDF. */}
        <MathCopyButton />
        <Toast />
        <KeyboardShortcuts />
        {/* Last, and a sibling of the workspace rather than a replacement for
            it: the editor stays mounted underneath so its buffer, scroll
            position and in-flight autosave survive a trip to preferences. */}
        <PreferencesWindow />
      </Provider>
    </div>
  );
};

export default styled(App)`
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: var(--wp-font-family-ui);

  .wp-shell {
    flex: 1 1 auto;
    display: flex;
    /* min-height:0 so the sidebar's list and the preview scroll internally
       rather than stretching the shell past the viewport. */
    min-height: 0;
  }

  .wp-workspace {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    /* min-width:0 so the editor/preview split can shrink inside the 260px-
       narrower viewport instead of overflowing it. */
    min-width: 0;
    min-height: 0;
  }
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
