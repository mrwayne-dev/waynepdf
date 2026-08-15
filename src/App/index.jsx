import styled from 'styled-components';
import { Provider } from 'nonaction';
import { Header, Markdown } from './Components';
import { TextContainer } from './Container';

const App = ({ className }) => {
  return (
    <div className={className} id="waynepdf-app">
      <Provider inject={[TextContainer]}>
        <Header />
        <Markdown />
      </Provider>
    </div>
  );
};

export default styled(App)`
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: 微軟正黑體, sans-serif;
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
