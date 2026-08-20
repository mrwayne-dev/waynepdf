/**
 * Hands the browser a file.
 *
 * The object URL is revoked on the next task rather than in the same tick as the
 * click: revoking immediately has been observed to cancel the in-flight download
 * in more than one browser.
 */
export function downloadBlob(content, filename, mime) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return blob;
}

/*
 * Path separators, the Windows-reserved set, and control codes.
 *
 * Spaces and hyphens are deliberately NOT stripped — the title becomes a
 * filename the user reads, and "Q3 Report" must not arrive as "Q3Report".
 */
// eslint-disable-next-line no-control-regex
const UNSAFE = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Filesystem-safe, collapsed, bounded, and never empty. */
export function safeFilename(name) {
  const cleaned = String(name ?? '')
    .replace(UNSAFE, '')
    .replace(/\s+/g, ' ')
    .trim()
    // Trailing dots and spaces are legal in a JS string and not in a Windows
    // filename.
    .replace(/[. ]+$/, '')
    .slice(0, 120);
  return cleaned || 'Document';
}
