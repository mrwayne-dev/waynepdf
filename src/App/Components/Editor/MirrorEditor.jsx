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
import { initialText } from '../../Container/Hooks/InitialText.js';
import { ThemeContainer } from '../../Container';
import { codeMirrorTheme } from '../../Lib/applyTheme.js';

const Editor = ({ className, setText }) => {
  const [settings] = useProvided(ThemeContainer);

  return (
    <CodeMirror
      className={className}
      value={initialText}
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
  height: 100%;
  .CodeMirror {
    height: 100%;
    line-height: 1.5;
    /* The editor is chrome, not document: it tracks the code size setting but
       not the body font family, which belongs to the rendered output. */
    font-family: var(--wp-font-family-mono);
    font-size: var(--wp-font-size-code);
  }
`;
