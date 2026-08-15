import { readFileWithEncoding, encodingMessage } from './readFile.js';
import uploadFile from './uploadFile.js';

/**
 * The single path a file takes into the editor, shared by the file picker and
 * drag-and-drop.
 *
 * Both entry points previously carried their own FileReader block, which is how
 * they drifted: only one of them checked for read errors. Centralising also
 * means encoding detection, the banner and language detection are guaranteed to
 * fire together.
 */
export default async function loadDocument(file, { showBanner, detectNow }) {
  const result = await readFileWithEncoding(file);

  if (result.error) {
    showBanner?.({
      variant: 'warning',
      message: `Could not read file: ${result.error}`,
    });
    return result;
  }

  uploadFile(result.text);
  // File loads bypass the debounce: the whole document is already here, and
  // waiting would show one beat of the wrong font stack.
  detectNow?.(result.text);
  showBanner?.(encodingMessage(result));

  return result;
}
