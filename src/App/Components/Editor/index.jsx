import styled from 'styled-components';
import Mirror from './MirrorEditor.jsx';

const Editor = ({ className, setText, width }) => {
  return (
    <div style={{ width }} className={className}>
      <Mirror setText={setText} />
    </div>
  );
};

export default styled(Editor)`
  flex-shrink: 0;
  height: 100%;
  width: 50%;
  color: rgb(204, 204, 204);
`;
