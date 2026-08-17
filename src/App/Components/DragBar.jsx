import styled from 'styled-components';

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
  /* A hairline rule, not a gutter. The 15px handle inherited from upstream read
     as an empty third column between the panes. */
  width: 4px;
  flex-shrink: 0;
  height: 100%;
  background-color: ${(props) =>
    props.isDrag ? 'var(--wp-color-accent)' : 'var(--wp-color-border)'};
  cursor: col-resize;
  user-select: none;
  transition: background-color var(--wp-ui-transition);
  &:hover {
    background-color: var(--wp-color-accent);
  }
`;
