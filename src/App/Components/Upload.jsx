import { useProvided } from 'nonaction';
import loadDocument from '../Lib/loadDocument.js';
import { EncodingBannerContainer, LanguageContainer } from '../Container';

/**
 * The file picker.
 *
 * Lived in the header until 7.2, which cut that bar down to controls scoped to
 * the document you already have. Importing one belongs with the rest of
 * document management, so it sits under New Document in the sidebar. It is not
 * merely decorative: dropping a file works too, but the picker is the only path
 * for anyone who cannot drag.
 */
export default function Upload(props) {
  const [, { showBanner }] = useProvided(EncodingBannerContainer);
  const [, { detectNow }] = useProvided(LanguageContainer);

  const onChange = (e) => {
    const files = e.currentTarget.files;
    if (files.length === 0) return;
    // Reading is async now — encoding detection needs the bytes, not a string.
    loadDocument(files[0], { showBanner, detectNow });
    // Let the same file be picked twice in a row; without this the input keeps
    // its value and the second selection fires no change event.
    e.currentTarget.value = '';
  };
  return (
    <p {...props} style={{ position: 'relative' }}>
      <input
        id="mdFile"
        type="file"
        style={{ display: 'none' }}
        onChange={onChange}
        accept=".md"
      />
      <label
        htmlFor="mdFile"
        style={{
          position: 'absolute',
          opacity: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          cursor: 'pointer',
        }}
      />
      <span>Open a file…</span>
    </p>
  );
}
