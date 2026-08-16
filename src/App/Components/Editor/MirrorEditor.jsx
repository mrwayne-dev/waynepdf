import { useRef } from 'react';
import { UnControlled as CodeMirror } from 'react-codemirror2';
import styled from 'styled-components';
import { useProvided } from 'nonaction';
import 'codemirror/lib/codemirror.css';
// Bundled CM5 themes. `default` needs no file — it ships in codemirror.css.
// solarized.css carries both the light and dark variants.
import 'codemirror/theme/darcula.css';
import 'codemirror/theme/solarized.css';
import 'codemirror/theme/eclipse.css';
import 'codemirror/mode/gfm/gfm.js';
import { ThemeContainer, useDocumentsApi } from '../../Container';
import { codeMirrorTheme } from '../../Lib/applyTheme.js';

/*
 * Seeded from the active document, once, per document.
 *
 * This used to be pinned to `initialText`, which was correct while the editor
 * was the source of truth. It is not any more: the text arrives from IndexedDB,
 * so a pinned seed meant that after every reload the editor showed the default
 * document while the preview showed the saved one — and the first keystroke
 * would push the editor's stale buffer back over the user's real work.
 *
 * The seed cannot simply track `text`, either. UnControlled re-hydrates whenever
 * its `value` prop changes, so feeding it the live text would replace the whole
 * document on every keystroke and throw the cursor to the end. Instead the value
 * is frozen per document and `key` forces a fresh instance when the active
 * document changes — which is also exactly the behaviour a tab switch needs.
 */
const Editor = ({ className, setText }) => {
  const [settings] = useProvided(ThemeContainer);
  const { activeId, activeDocument, ready } = useDocumentsApi();

  const seed = useRef({ id: null, body: '' });
  if (seed.current.id !== activeId) {
    seed.current = { id: activeId, body: activeDocument?.body ?? '' };
  }

  // Nothing to seed with yet; mounting now would show an empty editor and then
  // replace it a beat later.
  if (!ready) return null;

  return (
    <CodeMirror
      key={activeId}
      className={className}
      value={seed.current.body}
      options={{
        mode: 'gfm',
        theme: codeMirrorTheme(settings.resolvedTheme),
        lineNumbers: true,
        lineWrapping: true,
      }}
      onChange={(editor, data, value) => {
        setText(value);
      }}
    />
  );
};

export default styled(Editor)`
  /* Fills whatever the editor column has left after the encoding banner.
     min-height:0 so a long document cannot push the flex item past the pane. */
  flex: 1;
  min-height: 0;
  .CodeMirror {
    height: 100%;
    line-height: 1.5;
    /* The editor is chrome, not document: it tracks the code size setting but
       not the body font family, which belongs to the rendered output. */
    font-family: var(--wp-font-family-mono);
    font-size: var(--wp-font-size-code);
  }
`;
