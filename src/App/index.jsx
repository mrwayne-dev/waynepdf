import styled from 'styled-components';
import { Provider } from 'nonaction';
import { Header, Markdown } from './Components';
import Toast from './Components/Toast.jsx';
import MathCopyButton from './Components/Previewer/MathCopyButton.jsx';
import {
  TextContainer,
  ThemeContainer,
  LanguageContainer,
  EncodingBannerContainer,
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
        ]}
      >
        <Header />
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
