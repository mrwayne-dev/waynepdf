const XML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/*
 * XML 1.0 forbids most control characters outright — not escaped, not permitted
 * at all. A single stray one makes Word reject the whole package with a generic
 * "unreadable content" dialog that names no cause, so they are dropped rather
 * than encoded. Tab (09), newline (0A) and carriage return (0D) are the three
 * that are legal, and are kept.
 */
// eslint-disable-next-line no-control-regex
const ILLEGAL_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g;

export function xmlEscape(value) {
  return String(value ?? '')
    .replace(ILLEGAL_XML, '')
    .replace(/[&<>"']/g, (character) => XML_ESCAPES[character]);
}
