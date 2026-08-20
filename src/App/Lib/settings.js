/*
 * The settings schema, its validation, and its localStorage round-trip.
 *
 * Kept separate from applyTheme.js (which touches the DOM) and useTheme.js
 * (which owns React state) so the validation rules can be unit-tested on their
 * own — they are the part most likely to meet hostile input, since anything can
 * write to localStorage.
 */

export const STORAGE_KEY = 'waynepdf.settings.v1';

export const THEMES = [
  'light',
  'dark',
  'sepia',
  'high-contrast',
  'print-optimized',
  'system',
];

/**
 * A stored theme is one of the presets, 'system', or `custom-{uuid}`.
 *
 * The custom id is not checked against the stored custom themes here: the two
 * live in separate localStorage keys and either can be read first, so rejecting
 * an id whose theme has not loaded yet would silently reset the user's choice on
 * every boot. A `custom-*` value pointing at a deleted theme resolves to its
 * base preset at apply time instead.
 */
export function isValidTheme(value) {
  if (typeof value !== 'string') return false;
  if (THEMES.includes(value)) return true;
  return /^custom-[0-9a-f-]{36}$/i.test(value);
}

export const FONT_FAMILIES = ['sans', 'serif', 'mono'];

export const DEFAULTS = {
  theme: 'system',
  fontFamily: 'sans',
  fontSize: 16,
  lineHeight: 1.6,
  codeFontSize: 14,
  /*
   * The editor's own type size, deliberately separate from codeFontSize.
   *
   * They defaulted to one value because the editor borrowed the document's code
   * variable, which conflated two unrelated things: how big fenced code looks in
   * the rendered output, and how big the source is while you write it. Someone
   * on a large monitor wants a bigger editor without inflating every code block
   * in their PDF.
   */
  editorFontSize: 14,
  mathCopyEnabled: true,
  sanitizeHtml: false,
};

/** Slider bounds, also used to build the range inputs so the two cannot drift. */
export const RANGES = {
  fontSize: { min: 12, max: 24, step: 1 },
  lineHeight: { min: 1.2, max: 2.0, step: 0.05 },
  codeFontSize: { min: 10, max: 20, step: 1 },
  editorFontSize: { min: 10, max: 24, step: 1 },
};

const inRange = (value, { min, max }) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;

/**
 * Coerces arbitrary input into a valid settings object.
 *
 * Every field is validated independently, so one bad value doesn't discard the
 * rest — a stored `fontSize: 999` alongside a good `theme: "dark"` keeps the
 * dark theme and resets only the size.
 */
export function normalizeSettings(input) {
  const raw = input && typeof input === 'object' ? input : {};
  return {
    theme: isValidTheme(raw.theme) ? raw.theme : DEFAULTS.theme,
    fontFamily: FONT_FAMILIES.includes(raw.fontFamily)
      ? raw.fontFamily
      : DEFAULTS.fontFamily,
    fontSize: inRange(raw.fontSize, RANGES.fontSize)
      ? raw.fontSize
      : DEFAULTS.fontSize,
    lineHeight: inRange(raw.lineHeight, RANGES.lineHeight)
      ? raw.lineHeight
      : DEFAULTS.lineHeight,
    codeFontSize: inRange(raw.codeFontSize, RANGES.codeFontSize)
      ? raw.codeFontSize
      : DEFAULTS.codeFontSize,
    editorFontSize: inRange(raw.editorFontSize, RANGES.editorFontSize)
      ? raw.editorFontSize
      : DEFAULTS.editorFontSize,
    // Booleans have no range to clamp; anything non-boolean is the default.
    mathCopyEnabled:
      typeof raw.mathCopyEnabled === 'boolean'
        ? raw.mathCopyEnabled
        : DEFAULTS.mathCopyEnabled,
    sanitizeHtml:
      typeof raw.sanitizeHtml === 'boolean'
        ? raw.sanitizeHtml
        : DEFAULTS.sanitizeHtml,
  };
}

/**
 * Reads settings from localStorage. Never throws: a missing key, unparseable
 * JSON, a non-object payload, or a storage access that Safari private mode
 * refuses all resolve to DEFAULTS.
 */
export function loadSettings() {
  let stored;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { ...DEFAULTS };
  }
  if (stored === null || stored === undefined) return { ...DEFAULTS };

  let parsed;
  try {
    parsed = JSON.parse(stored);
  } catch {
    // Malformed value: replace it rather than leaving a landmine for next load.
    saveSettings(DEFAULTS);
    return { ...DEFAULTS };
  }
  return normalizeSettings(parsed);
}

/** Writes settings. Never throws — a full or blocked quota is not fatal here. */
export function saveSettings(settings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* persistence is best-effort; the in-memory state is still correct */
  }
}
