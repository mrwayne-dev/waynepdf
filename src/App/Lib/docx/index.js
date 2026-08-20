import { parseMarkdown } from './parse.js';
import { buildPackage } from './buildPackage.js';
import { preprocessForExport } from '../exportPreprocess.js';
import { deriveExportTitle } from '../exportHTML.js';
import { downloadBlob, safeFilename } from '../downloadBlob.js';
import { parseFrontmatter } from '../parseFrontmatter.js';

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/*
 * DOCX export.
 *
 * A .docx is a zip of OOXML parts, and the subset that covers WaynePDF's content
 * is small enough to write in-house. The alternative was pandoc-wasm: 56 MB and
 * GPL-2.0-or-later against this project's MIT, which is not a trade to make
 * quietly inside a feature commit.
 *
 * Loaded through a dynamic import from the dispatcher, so jszip and this writer
 * stay out of the main chunk.
 */
export async function exportDOCX({
  body,
  layout,
  frontmatter,
  resolvedTheme,
  md,
} = {}) {
  /*
   * The frontmatter block is metadata, not content.
   *
   * Without this the YAML renders as a paragraph at the top of the document —
   * exactly the bug 6d.1's HTML export shipped with, for exactly the same
   * reason: the raw source went to a renderer instead of the stripped body.
   */
  const parsed = parseFrontmatter(body ?? '');
  const meta = frontmatter ?? parsed.frontmatter;

  const { markdown } = await preprocessForExport(parsed.body, {
    theme: resolvedTheme,
  });
  const blocks = parseMarkdown(markdown, md ?? (await loadMd()));
  const title = deriveExportTitle({ body, layout });

  const zip = buildPackage(blocks, {
    title,
    author: meta?.author ?? '',
    date: meta?.date,
  });
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: DOCX_MIME,
    compression: 'DEFLATE',
  });

  downloadBlob(blob, `${safeFilename(title)}.docx`, DOCX_MIME);
  return { bytes: blob.size, blocks: blocks.length };
}

/** The app's own markdown-it, so DOCX sees exactly what the preview parses. */
async function loadMd() {
  const module = await import('../../Components/Previewer/Preview.jsx');
  return module.md;
}
