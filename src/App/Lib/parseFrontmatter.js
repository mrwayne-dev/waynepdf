import { load as parseYaml } from 'js-yaml';

/*
 * YAML frontmatter: parsed out of the document, never rendered.
 *
 * js-yaml directly rather than gray-matter. gray-matter is Node-oriented and
 * throws "Buffer is not defined" in a browser, which surfaced as *every* valid
 * frontmatter block reporting a parse error. Polyfilling Buffer to get it
 * working would ship a shim for the sake of ten lines of delimiter splitting,
 * and gray-matter's own YAML engine is js-yaml anyway.
 *
 * YAML only in Phase 6. gray-matter also spoke TOML and JSON; neither has been
 * asked for, and each brings its own delimiter ambiguities.
 */

/**
 * Splits a leading `---` fenced block off the front of a document.
 *
 * Anchored to the very first line: a `---` that appears later is a horizontal
 * rule and must stay one. The closing fence must also be on its own line, so a
 * document whose body happens to contain `---` inside a code block is safe.
 */
function splitFrontmatter(source) {
  if (!/^---[ \t]*\r?\n/.test(source)) return null;
  const rest = source.slice(source.indexOf('\n') + 1);
  const close = rest.search(/^---[ \t]*(\r?\n|$)/m);
  if (close === -1) return null;
  const yamlText = rest.slice(0, close);
  const after = rest.slice(close);
  // Drop the closing fence line itself.
  const nl = after.indexOf('\n');
  const body = nl === -1 ? '' : after.slice(nl + 1);
  return { yamlText, body };
}

/**
 * @returns {{ frontmatter: object, body: string, error: string|null }}
 *
 * On a parse failure the body is returned *unchanged* — including the malformed
 * block — so the user can see and fix the YAML they wrote. Swallowing it would
 * leave them staring at a document that silently lost its first few lines.
 */
export function parseFrontmatter(text) {
  const source = typeof text === 'string' ? text : '';
  // Cheap bail-out: no leading delimiter means no frontmatter, and this runs on
  // every keystroke.
  if (!source.startsWith('---')) {
    return { frontmatter: {}, body: source, error: null };
  }

  const split = splitFrontmatter(source);
  if (!split) return { frontmatter: {}, body: source, error: null };

  try {
    const data = parseYaml(split.yamlText);
    return {
      frontmatter: data && typeof data === 'object' ? data : {},
      body: split.body,
      error: null,
    };
  } catch (err) {
    return {
      frontmatter: {},
      body: source,
      error: err?.message ?? 'Invalid YAML',
    };
  }
}

const THEMES = new Set([
  'light',
  'dark',
  'sepia',
  'high-contrast',
  'print-optimized',
  'system',
]);
const PAGE_SIZES = new Set(['a4', 'letter', 'legal', 'a5', 'a3']);
const ORIENTATIONS = new Set(['portrait', 'landscape']);
const DIRECTIONS = new Set(['ltr', 'rtl', 'auto']);
const MARGIN_PRESETS = new Set(['small', 'normal', 'wide']);

const str = (v) => (typeof v === 'string' ? v : undefined);

/**
 * Maps raw frontmatter onto the shape the settings hooks expect.
 *
 * Every value is validated the same way the persisted settings are: a document
 * is untrusted input just like localStorage. An unrecognised key or an invalid
 * value is dropped silently — a document that says `theme: neon` renders in the
 * user's own theme rather than erroring at them mid-sentence.
 */
export function toOverrides(frontmatter = {}) {
  const fm = frontmatter && typeof frontmatter === 'object' ? frontmatter : {};
  const out = {};

  if (typeof fm.theme === 'string' && THEMES.has(fm.theme.toLowerCase())) {
    out.theme = fm.theme.toLowerCase();
  }

  // BCP47 is not validated beyond its shape — the language container already
  // rejects tags it has no font stack for.
  if (str(fm.lang)) out.lang = fm.lang;
  if (typeof fm.dir === 'string' && DIRECTIONS.has(fm.dir.toLowerCase())) {
    out.direction = fm.dir.toLowerCase();
  }

  if (
    typeof fm.pageSize === 'string' &&
    PAGE_SIZES.has(fm.pageSize.toLowerCase())
  ) {
    out.pageSize = fm.pageSize.toLowerCase();
  }
  if (
    typeof fm.orientation === 'string' &&
    ORIENTATIONS.has(fm.orientation.toLowerCase())
  ) {
    out.orientation = fm.orientation.toLowerCase();
  }
  // `margin` accepts a preset name or a number of millimetres.
  if (
    typeof fm.margin === 'string' &&
    MARGIN_PRESETS.has(fm.margin.toLowerCase())
  ) {
    out.marginPreset = fm.margin.toLowerCase();
  } else if (typeof fm.margin === 'number' && Number.isFinite(fm.margin)) {
    out.marginPreset = 'custom';
    out.marginTop = fm.margin;
    out.marginRight = fm.margin;
    out.marginBottom = fm.margin;
    out.marginLeft = fm.margin;
  }

  // `toc: true` or `toc: { enabled, depth }`.
  if (typeof fm.toc === 'boolean') {
    out.toc = { enabled: fm.toc };
  } else if (fm.toc && typeof fm.toc === 'object') {
    const toc = {};
    if (typeof fm.toc.enabled === 'boolean') toc.enabled = fm.toc.enabled;
    else toc.enabled = true; // `toc: {depth: 3}` clearly means "yes, and deep"
    if ([1, 2, 3].includes(fm.toc.depth)) toc.depth = fm.toc.depth;
    out.toc = toc;
  }

  // `watermark: "DRAFT"` or `watermark: { text, opacity }`.
  if (typeof fm.watermark === 'string') {
    out.watermark = { text: fm.watermark };
  } else if (fm.watermark && typeof fm.watermark === 'object') {
    const wm = {};
    if (str(fm.watermark.text) !== undefined) wm.text = fm.watermark.text;
    if (
      typeof fm.watermark.opacity === 'number' &&
      fm.watermark.opacity >= 0 &&
      fm.watermark.opacity <= 1
    ) {
      wm.opacity = fm.watermark.opacity;
    }
    if (Object.keys(wm).length) out.watermark = wm;
  }

  /*
   * Cover. title/subtitle/author/date are the natural way to write this, so
   * they imply `cover: true` — otherwise they would be inert and the user would
   * have no way to tell why. An explicit `cover: false` still wins.
   */
  const cover = {};
  if (str(fm.title) !== undefined) cover.title = fm.title;
  if (str(fm.subtitle) !== undefined) cover.subtitle = fm.subtitle;
  if (str(fm.author) !== undefined) cover.author = fm.author;
  if (fm.date !== undefined) cover.date = String(fm.date);
  if (fm.cover && typeof fm.cover === 'object') {
    for (const key of ['title', 'subtitle', 'author', 'date']) {
      if (str(fm.cover[key]) !== undefined) cover[key] = fm.cover[key];
    }
    if (typeof fm.cover.enabled === 'boolean') cover.enabled = fm.cover.enabled;
    else cover.enabled = true;
  } else if (typeof fm.cover === 'boolean') {
    cover.enabled = fm.cover;
  } else if (Object.keys(cover).length > 0) {
    cover.enabled = true;
  }
  if (Object.keys(cover).length) out.cover = cover;

  return out;
}
