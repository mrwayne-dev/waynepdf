import { xmlEscape } from '../xmlEscape.js';

const NS =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/**
 * word/_rels/document.xml.rels — the only relationship part that varies.
 *
 * Styles and numbering are fixed. Hyperlinks and images are collected while the
 * document is built, so the ids here have to be exactly the ids document.xml
 * emitted. A mismatch is not a parse error: Word opens the file and silently
 * drops the link or the picture, which is the worst kind of failure to chase.
 *
 * External targets (hyperlinks) need TargetMode="External"; internal ones
 * (images, resolved relative to word/) must not have it.
 */
export function renderDocumentRels(relationships = []) {
  const fixed = [
    `<Relationship Id="rIdStyles" Type="${NS}/styles" Target="styles.xml"/>`,
    `<Relationship Id="rIdNumbering" Type="${NS}/numbering" Target="numbering.xml"/>`,
  ];
  const dynamic = relationships.map((rel) =>
    rel.external
      ? `<Relationship Id="${rel.id}" Type="${NS}/hyperlink" Target="${xmlEscape(rel.target)}" TargetMode="External"/>`
      : `<Relationship Id="${rel.id}" Type="${NS}/image" Target="${xmlEscape(rel.target)}"/>`,
  );
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${fixed.join('')}${dynamic.join('')}</Relationships>`;
}
