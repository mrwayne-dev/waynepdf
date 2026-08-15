import styled from 'styled-components';

const width = 15;

const UnwrappedDragBar = ({ className, setDrag, setStartX }) => {
  const dragStart = (e) => {
    const { nativeEvent } = e;
    const offsetX = nativeEvent.offsetX;
    setStartX(offsetX);
  };
  return (
    <div
      className={className}
      onMouseDown={(e) => {
        setDrag(true);
        dragStart(e);
      }}
    />
  );
};

export default styled(UnwrappedDragBar)`
  width: ${width + 'px'};
  flex-shrink: 0;
  background-color: ${(props) =>
    props.isDrag ? 'var(--wp-color-accent)' : 'var(--wp-color-canvas-subtle)'};
  border-left: 1px solid var(--wp-color-border);
  border-right: 1px solid var(--wp-color-border);
  height: 100%;
  color: white;
  text-align: center;
  cursor: col-resize;
  user-select: none;
`;
