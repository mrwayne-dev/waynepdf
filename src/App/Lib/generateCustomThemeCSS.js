import { PRESET_PALETTES } from './presetPalettes.js';

/*
 * Custom themes as CSS.
 *
 * A custom theme is a preset plus a partial override map. It reaches the page the
 * same way the presets do — a `[data-theme="..."]` block whose declarations are
 * the `--wp-color-*` tokens — so everything downstream (the markdown fork, the
 * print pipeline, paged.js's page box, the exported HTML in 6d) picks it up with
 * no knowledge that custom themes exist at all.
 *
 * The full merged palette is emitted, not just the overrides. A partial block
 * would inherit the rest from :root, which carries the *Light* fallback, so a
 * custom theme based on Dark would come out with Light's borders and muted
 * greys wherever the user had not set a colour.
 */

export const CUSTOM_THEME_STYLE_ID = 'wp-custom-themes';

/** `custom-{id}` — the value that goes in `data-theme`. */
export const customThemeId = (id) => `custom-${id}`;

/** A custom theme's full palette: its base preset with its overrides applied. */
export function mergedPalette(theme) {
  const base = PRESET_PALETTES[theme?.basedOn] ?? PRESET_PALETTES.light;
  const overrides =
    theme?.overrides && typeof theme.overrides === 'object'
      ? theme.overrides
      : {};
  return { ...base, ...overrides };
}

/** One `[data-theme]` block. Exported so the editor's live preview can reuse it. */
export function paletteBlock(selector, palette) {
  const props = Object.entries(palette)
    .map(([token, value]) => `  ${token}: ${value};`)
    .join('\n');
  return `${selector} {\n${props}\n}`;
}

export function generateCustomThemeCSS(themes) {
  if (!Array.isArray(themes) || themes.length === 0) return '';
  return themes
    .map((theme) =>
      paletteBlock(
        `[data-theme="${customThemeId(theme.id)}"]`,
        mergedPalette(theme),
      ),
    )
    .join('\n\n');
}

/**
 * Writes the generated CSS into a single <style> in <head>, creating it once.
 *
 * One element rewritten in place rather than one per theme: the whole sheet is
 * regenerated on any change, and swapping textContent is atomic where removing
 * and re-adding elements would flash the page through an unstyled state.
 */
export function applyCustomThemeCSS(themes) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(CUSTOM_THEME_STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = CUSTOM_THEME_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = generateCustomThemeCSS(themes);
  setCustomThemeBases(themes);
}

/*
 * Which preset each custom theme is built on.
 *
 * A module-level lookup because two things outside React need it and cannot
 * reach a container: applyTheme has to pick a highlight.js and a CodeMirror
 * theme, and neither has a `custom-*` entry. Without this a Dark-based custom
 * theme gets Light's code highlighter — dark page, light code block.
 *
 * The alternative was making useTheme read the custom-theme container, which
 * nonaction cannot do (both are container hooks, both run above the context).
 * See the note in Lib/frontmatterOverrides.js for the same wall.
 */
let baseByCustomId = new Map();

export function setCustomThemeBases(themes) {
  baseByCustomId = new Map(
    (Array.isArray(themes) ? themes : []).map((theme) => [
      theme.id,
      PRESET_PALETTES[theme.basedOn] ? theme.basedOn : 'light',
    ]),
  );
}

/**
 * A theme name reduced to a preset: `custom-{id}` becomes its base, anything
 * else passes through. Unknown custom ids fall back to light rather than
 * returning a value no palette map has a key for.
 */
export function basePresetFor(theme) {
  if (typeof theme !== 'string' || !theme.startsWith('custom-')) return theme;
  return baseByCustomId.get(theme.slice('custom-'.length)) ?? 'light';
}

export const isCustomTheme = (theme) =>
  typeof theme === 'string' && theme.startsWith('custom-');

/** Test-only. */
export function __resetCustomThemeBases() {
  baseByCustomId = new Map();
}
