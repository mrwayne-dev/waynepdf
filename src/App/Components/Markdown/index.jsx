import { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useProvided } from 'nonaction';
import {
  TextContainer,
  LanguageContainer,
  EncodingBannerContainer,
  PageCountContainer,
} from '../../Container';
import Previewer from '../Previewer/index.jsx';
import Editor from '../Editor/index.jsx';
import DragBar from '../DragBar.jsx';
import useDrop from '../../Container/Hooks/useDrop.js';
import loadDocument from '../../Lib/loadDocument.js';

const Markdown = ({ className }) => {
  const [text, setText, { ready }] = useProvided(TextContainer);
  const [, { observeText, detectNow }] = useProvided(LanguageContainer);
  const [, { showBanner }] = useProvided(EncodingBannerContainer);
  const [, { setPageCount }] = useProvided(PageCountContainer);
  const [isDrag, setDrag] = useState(false);
  const [startX, setStartX] = useState(0);
  const [width, setWidth] = useState(window.innerWidth / 2);
  const markdownRef = useRef(null);

  const onDropFile = useCallback(
    (file) => loadDocument(file, { showBanner, detectNow }),
    [showBanner, detectNow],
  );
  const [uploading, isOver] = useDrop(markdownRef, onDropFile);

  // Language detection follows the document, debounced inside the container.
  useEffect(() => {
    observeText(text);
  }, [text, observeText]);

  useEffect(() => {
    const handleMouseUp = () => setDrag(false);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  // The state `isDrag` must be false, when mouse up!
  // So we listen it in window! (Seems ugly, but it just works ha.)

  /*
   * Test-only hook: lets Playwright drive the preview without touching
   * CodeMirror's DOM. Compiled out of production builds.
   *
   * Gated on `ready` so it doubles as the app's settle signal. Documents load
   * from IndexedDB asynchronously now, so a test that seeds text the moment the
   * hook appears would otherwise race the active document arriving and be
   * overwritten by it.
   */
  useEffect(() => {
    if (!(import.meta.env.DEV || import.meta.env.MODE === 'test')) return;
    if (!ready) return;
    /*
     * Writes through CodeMirror rather than straight to the container.
     *
     * Setting the container directly leaves the editor's own buffer holding
     * something else, and any later remount replays that stale buffer over the
     * document — which showed up as tab tests losing a document's text at
     * random. Going through setValue is also what a real file drop does
     * (Lib/uploadFile.js), so tests exercise the path users take.
     */
    window.__waynepdf_setText = (value) => {
      /*
       * Every instance, not the last one.
       *
       * StrictMode leaves two connected .CodeMirror nodes, and a tab switch
       * remounts the live one — after which the survivor is not reliably last
       * in DOM order. Writing to the wrong one is silent: react-codemirror2's
       * change handler early-returns once its component has unmounted, so the
       * text simply never reaches the store. Writing to all of them is
       * deterministic, and the dead instances ignore it.
       */
      const nodes = [...document.querySelectorAll('.CodeMirror')];
      const editors = nodes.map((n) => n.CodeMirror).filter(Boolean);
      if (editors.length === 0) setText(value);
      else for (const editor of editors) editor.setValue(value);
    };
    return () => {
      delete window.__waynepdf_setText;
    };
  }, [setText, ready]);

  return (
    <div
      ref={markdownRef}
      style={{ opacity: isOver || uploading ? 0.5 : 1 }}
      /* wp-split is a stable hook for the print reset; `className` alone is a
         styled-components hash that CSS files cannot name. */
      className={`${className} wp-split`}
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
      <Previewer onPagesReady={setPageCount}>{text}</Previewer>
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
