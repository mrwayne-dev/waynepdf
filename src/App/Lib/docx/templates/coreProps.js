import { xmlEscape } from '../xmlEscape.js';

/** Document metadata — what Word shows under File > Info. */
export function renderCoreProps({ title, author, date }) {
  const created = toW3CDTF(date);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(title)}</dc:title><dc:creator>${xmlEscape(author ?? '')}</dc:creator><cp:lastModifiedBy>${xmlEscape(author ?? '')}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`;
}

/**
 * dcterms:W3CDTF wants a full timestamp.
 *
 * Frontmatter dates are usually a bare `2026-08-20`. That is a legal W3CDTF
 * *date*, but this field wants a dateTime, so it is widened to midnight UTC.
 * Anything unparseable falls back to now rather than writing a malformed
 * timestamp into the package — a bad one there is a validation error, not a
 * cosmetic problem.
 */
function toW3CDTF(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00Z`;
  }
  const parsed = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return `${date.toISOString().split('.')[0]}Z`;
}
