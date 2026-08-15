import styled from 'styled-components';
import UploadButton from '../Upload.jsx';
import Settings from '../Settings/index.jsx';

const Header = ({ className }) => {
  const onTransfrom = () => {
    // get the file name
    let candidateTitle = '';
    const previewEl = document.querySelector('.preview');
    const candidateTitleEl = previewEl.querySelector('h1');
    if (candidateTitleEl) {
      candidateTitle = candidateTitleEl.innerText;

      // do the effect change the title
      const currentTitle = document.title;
      document.title = candidateTitle;
      window.requestAnimationFrame(() => {
        // schedule resume back in next frame
        document.title = currentTitle;
      });
    }
    window.print();
  };
  return (
    <header className={className + ' no-print'}>
      <p className="project"> WaynePDF </p>
      <Settings />

      <div className="menu">
        <UploadButton className="button upload" />
        <p className="button download" onClick={onTransfrom}>
          <span>Transform</span>
        </p>
      </div>
    </header>
  );
};

export default styled(Header)`
  * {
    box-sizing: border-box;
  }
  flex-shrink: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  user-select: none;
  padding-left: 5px;
  padding-right: 5px;
  /* Theme tokens, not literals: the header sits outside .markdown-body, so
     without these it stays light grey in Dark and Sepia. */
  color: var(--wp-color-fg);
  background-color: var(--wp-color-canvas-subtle);
  border-bottom: 1px solid var(--wp-color-border);
  font-family: var(--wp-font-family-sans);
  font-size: var(--wp-ui-font-size);
  display: flex;
  align-items: center;
  height: 40px;
  .project {
    font-weight: bold;
    margin: 5px;
    flex-shrink: 0;
    height: 20px;
  }
  div.menu {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    .button {
      height: 80%;
      margin: 0;
      display: flex;
      align-items: center;
      margin-left: 3px;
      border-radius: var(--wp-ui-radius);
      border: 1px solid var(--wp-color-border);
      background-color: var(--wp-color-canvas);
      padding: 10px;
      cursor: pointer;
      transition: background-color var(--wp-ui-transition);
    }
    .button:hover {
      background-color: var(--wp-color-neutral-muted);
    }
  }

  @keyframes dance {
    0% {
      transform: rotate(3deg);
    }
    100% {
      transform: rotate(-2deg);
    }
  }
`;
