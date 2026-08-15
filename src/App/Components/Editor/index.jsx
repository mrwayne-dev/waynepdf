import styled from 'styled-components';
import Mirror from './MirrorEditor.jsx';
import EncodingBanner from '../EncodingBanner.jsx';

const Editor = ({ className, setText, width }) => {
  return (
    <div style={{ width }} className={className}>
      <EncodingBanner />
      <Mirror setText={setText} />
    </div>
  );
};

export default styled(Editor)`
  flex-shrink: 0;
  height: 100%;
  width: 50%;
  color: var(--wp-color-fg);
  /* Column so the encoding banner can take its natural height above the editor
     and CodeMirror absorbs the remainder, rather than overflowing the pane. */
  display: flex;
  flex-direction: column;
`;
