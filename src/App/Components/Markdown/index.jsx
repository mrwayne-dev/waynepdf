import { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { useProvided } from 'nonaction';
import { TextContainer } from '../../Container';
import Previewer from '../Previewer/index.jsx';
import Editor from '../Editor/index.jsx';
import DragBar from '../DragBar.jsx';
import useDrop from '../../Container/Hooks/useDrop.js';
import uploadFile from '../../Lib/uploadFile.js';

const Markdown = ({ className }) => {
  const [text, setText] = useProvided(TextContainer);
  const [isDrag, setDrag] = useState(false);
  const [startX, setStartX] = useState(0);
  const [width, setWidth] = useState(window.innerWidth / 2);
  const markdownRef = useRef(null);
  const [uploading, isOver] = useDrop(markdownRef, uploadFile);

  useEffect(() => {
    const handleMouseUp = () => setDrag(false);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  // The state `isDrag` must be false, when mouse up!
  // So we listen it in window! (Seems ugly, but it just works ha.)

  // Test-only hook: lets Playwright drive the preview without touching
  // CodeMirror's DOM. Compiled out of production builds.
  useEffect(() => {
    if (!(import.meta.env.DEV || import.meta.env.MODE === 'test')) return;
    window.__waynepdf_setText = setText;
    return () => {
      delete window.__waynepdf_setText;
    };
  }, [setText]);

  return (
    <div
      ref={markdownRef}
      style={{ opacity: isOver || uploading ? 0.5 : 1 }}
      className={className}
      onMouseMove={(e) => {
        if (!isDrag) return;
        const pageX = e.nativeEvent.pageX;
        setWidth(pageX - startX);
      }}
    >
      <Editor className="no-print" width={width} setText={setText} />
      <DragBar
        className="no-print"
        isDrag={isDrag}
        setDrag={setDrag}
        setStartX={setStartX}
      />
      <Previewer>{text}</Previewer>
    </div>
  );
};

export default styled(Markdown)`
  * {
    box-sizing: border-box;
  }
  height: calc(100% - 40px);
  display: flex;
`;
