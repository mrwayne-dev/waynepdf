import JSZip from 'jszip';
import { buildDocument } from './buildDocument.js';
import { CONTENT_TYPES_XML } from './templates/contentTypes.js';
import { ROOT_RELS_XML } from './templates/rootRels.js';
import { renderDocumentRels } from './templates/documentRels.js';
import { STYLES_XML } from './templates/styles.js';
import { NUMBERING_XML } from './templates/numbering.js';
import { renderCoreProps } from './templates/coreProps.js';

/** Every part a minimal package must contain, for the tests to assert against. */
export const REQUIRED_ENTRIES = [
  '[Content_Types].xml',
  '_rels/.rels',
  'word/_rels/document.xml.rels',
  'word/document.xml',
  'word/styles.xml',
  'word/numbering.xml',
  'docProps/core.xml',
];

export function buildPackage(blocks, { title, author, date } = {}) {
  const { documentXml, relationships, mediaFiles } = buildDocument(blocks);

  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.file('_rels/.rels', ROOT_RELS_XML);
  zip.file('word/_rels/document.xml.rels', renderDocumentRels(relationships));
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', STYLES_XML);
  zip.file('word/numbering.xml', NUMBERING_XML);
  zip.file('docProps/core.xml', renderCoreProps({ title, author, date }));

  for (const [name, bytes] of mediaFiles) {
    zip.file(`word/media/${name}`, bytes, { binary: true });
  }

  return zip;
}
