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

export const FONT_FAMILIES = ['sans', 'serif', 'mono'];

export const DEFAULTS = {
  theme: 'system',
  fontFamily: 'sans',
  fontSize: 16,
  lineHeight: 1.6,
  codeFontSize: 14,
};

/** Slider bounds, also used to build the range inputs so the two cannot drift. */
export const RANGES = {
  fontSize: { min: 12, max: 24, step: 1 },
  lineHeight: { min: 1.2, max: 2.0, step: 0.05 },
  codeFontSize: { min: 10, max: 20, step: 1 },
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
    theme: THEMES.includes(raw.theme) ? raw.theme : DEFAULTS.theme,
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
