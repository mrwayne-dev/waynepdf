import { renderMermaidSVG } from './mermaidLoader.js';
import {
  deriveDocumentTitle,
  UNTITLED,
} from '../Container/Hooks/useDocuments.js';
import {
  generateCustomThemeCSS,
  isCustomTheme,
} from './generateCustomThemeCSS.js';
import { downloadBlob, safeFilename } from './downloadBlob.js';

/*
 * Self-contained HTML export.
 *
 * The output has to open from a file:// URL on a machine that has never seen
 * WaynePDF and render identically. That rules out every kind of reference: no
 * stylesheet links, no font URLs, no script tags. Everything is inlined, which
 * makes "zero network requests when opened" the invariant worth testing rather
 * than "it looks right".
 */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHTML = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/**
 * The exported file's name and <title>.
 *
 * Reuses deriveDocumentTitle rather than re-deriving: it already strips
 * frontmatter and skips fenced code, so a shell example opening with `# install`
 * cannot name the file. Only the fallback differs — a tab reads better as
 * "Untitled", a downloaded file as "Document".
 */
export function deriveExportTitle({ body, layout }) {
  if (layout?.cover?.enabled && layout.cover.title) return layout.cover.title;
  const derived = deriveDocumentTitle(body ?? '');
  return derived === UNTITLED ? 'Document' : derived;
}

/* ------------------------------------------------------------------ mermaid */

const MERMAID_BLOCK =
  /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;

const decodeEntities = (html) => {
  const el = document.createElement('textarea');
  el.innerHTML = html;
  return el.value;
};

/**
 * Renders the document, then swaps each mermaid fence for its SVG.
 *
 * Rendered against mermaid's own detached container and matched on the emitted
 * HTML rather than the live preview's DOM: an export must not depend on the
 * preview being mounted, in the right mode, or finished rendering.
 */
export async function renderMarkdownWithMermaid(
  body,
  theme = 'default',
  sanitizeHtml = false,
) {
  /*
   * renderDocument, not md.render.
   *
   * It strips the YAML frontmatter and honours the sanitize setting — exactly
   * what the preview does. Calling md.render directly rendered the frontmatter
   * block as a paragraph, so every exported file opened with
   * "title: … author: … date: …" printed across the top.
   */
  const { renderDocument } =
    await import('../Components/Previewer/Preview.jsx');
  const { html } = renderDocument(body ?? '', { sanitizeHtml });

  const blocks = [...html.matchAll(MERMAID_BLOCK)];
  if (blocks.length === 0) return html;

  const rendered = await Promise.all(
    blocks.map(async (match, index) => {
      const source = decodeEntities(match[1]);
      try {
        // Deterministic and namespaced: one id per block position, so two
        // exports of the same document produce byte-identical output.
        const svg = await renderMermaidSVG(
          source,
          `wp-export-diagram-${index}`,
          theme,
        );
        return {
          match: match[0],
          html: `<div class="mermaid-diagram">${svg}</div>`,
        };
      } catch (error) {
        // The source stays visible, the same choice the live renderer makes.
        return {
          match: match[0],
          html: `<pre class="mermaid-error">Mermaid error: ${escapeHTML(
            error?.message ?? error,
          )}\n\n${escapeHTML(source)}</pre>`,
        };
      }
    }),
  );

  let out = html;
  for (const { match, html: replacement } of rendered) {
    out = out.replace(match, () => replacement);
  }
  return out;
}

/* ---------------------------------------------------------------- css + fonts */

/** `url(...)` occurrences inside a font-face src, quoted or not. */
const SRC_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*))\s*\)/g;

const MIME_BY_EXTENSION = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

const fontMime = (url) =>
  MIME_BY_EXTENSION[url.split('?')[0].split('.').pop()?.toLowerCase()] ??
  'application/octet-stream';

async function fetchAsDataURI(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const buffer = await response.arrayBuffer();
  // Chunked: a single String.fromCharCode(...bytes) blows the argument limit on
  // anything larger than a small subset.
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${fontMime(url)};base64,${btoa(binary)}`;
}

/** Font families the page has actually used, lowercased and unquoted. */
export function loadedFontFamilies() {
  const families = new Set();
  for (const font of document.fonts) {
    if (font.status !== 'loaded') continue;
    families.add(font.family.replace(/["']/g, '').toLowerCase());
  }
  return families;
}

/** The three selectable document faces, by their bundled family name. */
const BODY_FACE_BY_SETTING = {
  sans: 'inter variable',
  serif: 'source serif 4 variable',
  mono: 'jetbrains mono variable',
};

/*
 * Faces the exported document can never reference.
 *
 * "Loaded" is a necessary filter and not a sufficient one. The Settings panel
 * renders each font pill in the face it names, so opening the panel loads all
 * three document faces whether or not the document uses them — and every one of
 * them then rode along in the export at roughly 200 KB a piece.
 *
 * What the exported file can actually select is: the chosen body face, Inter
 * (callout titles and other furniture read --wp-font-family-ui), JetBrains Mono
 * (every code span), the KaTeX faces, and whichever language faces the page
 * loaded for this document's script. That leaves exactly one candidate to drop —
 * the unselected serif — which is worth dropping because it is a quarter of the
 * file.
 */
export function unusedBodyFaces(fontFamily) {
  const keep = new Set([
    BODY_FACE_BY_SETTING[fontFamily] ?? BODY_FACE_BY_SETTING.sans,
    BODY_FACE_BY_SETTING.sans, // --wp-font-family-ui
    BODY_FACE_BY_SETTING.mono, // inline and fenced code
  ]);
  return new Set(
    Object.values(BODY_FACE_BY_SETTING).filter((face) => !keep.has(face)),
  );
}

const ruleFamily = (rule) =>
  rule.style
    .getPropertyValue('font-family')
    .replace(/["']/g, '')
    .trim()
    .toLowerCase();

/**
 * Rewrites one @font-face rule with data URIs, or returns null to drop it.
 *
 * Only families `document.fonts` reports as loaded survive. The app declares
 * roughly 900 font-face rules — Noto CJK alone is ~100 subsets per script — and
 * an English document has used a handful of them. Filtering on loaded status is
 * the difference between a 300 KB export and a 20 MB one.
 */
async function inlineFontFace(rule, families, unused, stats) {
  const family = ruleFamily(rule);
  if (!families.has(family)) return null;
  if (unused.has(family)) {
    stats.droppedFamilies.add(family);
    return null;
  }

  const src = rule.style.getPropertyValue('src');
  const urls = [...src.matchAll(SRC_URL)].map((m) => m[1] ?? m[2] ?? m[3]);
  if (urls.length === 0) return null;

  let rewritten = src;
  for (const url of urls) {
    if (!url || url.startsWith('data:')) continue;
    try {
      const dataUri = await fetchAsDataURI(url);
      stats.bytes += dataUri.length;
      stats.count += 1;
      rewritten = rewritten.replace(url, dataUri);
    } catch (error) {
      console.warn('Export: could not inline font', url, error);
      return null;
    }
  }

  const parts = [
    `  font-family: ${rule.style.getPropertyValue('font-family')};`,
  ];
  // unicode-range is what keeps the subsetting meaningful in the exported file.
  for (const prop of [
    'font-style',
    'font-weight',
    'font-stretch',
    'font-display',
    'unicode-range',
  ]) {
    const value = rule.style.getPropertyValue(prop);
    if (value) parts.push(`  ${prop}: ${value};`);
  }
  parts.push(`  src: ${rewritten};`);
  return `@font-face {\n${parts.join('\n')}\n}`;
}

/**
 * Every rule the page is currently styled by, with fonts inlined.
 *
 * Read from `document.styleSheets` rather than from the source files: at runtime
 * this is the truth, including whichever highlight.js theme is enabled and any
 * custom-theme block generated in 6c.1.
 */
export async function collectAndInlineCSS({
  activeCustomTheme,
  fontFamily = 'sans',
} = {}) {
  const families = loadedFontFamilies();
  const unused = unusedBodyFaces(fontFamily);
  const stats = {
    bytes: 0,
    count: 0,
    skippedSheets: [],
    droppedFamilies: new Set(),
  };
  const chunks = [];

  for (const sheet of document.styleSheets) {
    // A disabled sheet is one of the three inactive hljs themes.
    if (sheet.disabled) continue;
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      // Cross-origin sheets throw on access. All bundled assets are same-origin,
      // so this should stay empty — it is logged rather than swallowed.
      stats.skippedSheets.push(sheet.href ?? '(inline)');
      continue;
    }
    if (!rules) continue;

    for (const rule of rules) {
      if (rule.constructor?.name === 'CSSFontFaceRule' || rule.type === 5) {
        const inlined = await inlineFontFace(rule, families, unused, stats);
        if (inlined) chunks.push(inlined);
        continue;
      }
      chunks.push(rule.cssText);
    }
  }

  if (stats.skippedSheets.length > 0) {
    console.warn(
      'Export: skipped cross-origin stylesheets',
      stats.skippedSheets,
    );
  }

  /*
   * The active custom theme's block, appended last so it wins.
   *
   * It is generated rather than read back from the injected <style>, so the
   * exported file carries the FULL merged palette the same way the app does —
   * a partial block would inherit :root's Light fallback in the standalone file.
   */
  if (activeCustomTheme) {
    chunks.push(generateCustomThemeCSS([activeCustomTheme]));
  }

  /*
   * The page frame.
   *
   * On screen the .preview wrapper supplies the canvas, the padding and the
   * 800px measure (6.5b). None of that is inside .markdown-body, so a standalone
   * file without it renders flush to both window edges at whatever width the
   * window happens to be. Appended last, in the same tokens, so the exported
   * document reads at the measure it was written at.
   */
  chunks.push(PAGE_FRAME_CSS);

  return { css: chunks.join('\n'), stats };
}

const PAGE_FRAME_CSS = `
html, body {
  margin: 0;
  padding: 0;
  background-color: var(--wp-color-canvas);
}
body {
  padding: var(--wp-space-6) var(--wp-space-8);
}
.markdown-body {
  box-sizing: border-box;
  max-width: 800px;
  margin-inline: auto;
}
@media (max-width: 900px) {
  body { padding: var(--wp-space-4); }
}
`;

/* --------------------------------------------------------------- assembly */

export function assembleHTML({
  renderedHTML,
  inlinedCSS,
  title,
  activeTheme,
  lang,
  dir,
}) {
  const langAttr = lang && lang !== 'und' ? ` lang="${escapeHTML(lang)}"` : '';
  const dirAttr = dir ? ` dir="${escapeHTML(dir)}"` : '';
  const themeAttr = activeTheme
    ? ` data-theme="${escapeHTML(activeTheme)}"`
    : '';

  return `<!DOCTYPE html>
<html${langAttr}${dirAttr}${themeAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="WaynePDF">
<title>${escapeHTML(title)}</title>
<style>
${inlinedCSS}
</style>
</head>
<body>
<div class="markdown-body">
${renderedHTML}
</div>
</body>
</html>
`;
}

export async function exportHTML({
  body,
  layout,
  theme,
  resolvedTheme,
  activeCustomTheme,
  fontFamily,
  sanitizeHtml = false,
  lang,
  dir,
} = {}) {
  const renderedHTML = await renderMarkdownWithMermaid(
    body,
    resolvedTheme,
    sanitizeHtml,
  );
  const { css, stats } = await collectAndInlineCSS({
    activeCustomTheme,
    fontFamily,
  });
  const title = deriveExportTitle({ body, layout });

  const html = assembleHTML({
    renderedHTML,
    inlinedCSS: css,
    title,
    // Custom themes carry their own data-theme value; presets use their name.
    activeTheme: isCustomTheme(theme) ? theme : (resolvedTheme ?? theme),
    lang,
    dir,
  });

  downloadBlob(html, `${safeFilename(title)}.html`, 'text/html;charset=utf-8');
  return { bytes: html.length, fonts: stats };
}
