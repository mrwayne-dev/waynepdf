/*
 * The one place that writes theme state to the DOM.
 *
 * Themes are CSS custom properties rather than a styled-components theme
 * object: vars cascade into the forked markdown stylesheet without every
 * component having to consume a context, they survive React reconciliation,
 * and — the reason that matters most here — they still apply inside the print
 * pipeline, where React is not running.
 */

/** App theme -> id of the highlight.js <link> that should be enabled. */
const HLJS_THEME_BY_THEME = {
  light: 'hljs-github',
  dark: 'hljs-github-dark',
  sepia: 'hljs-atom-one-light',
  'high-contrast': 'hljs-vs',
  'print-optimized': 'hljs-github',
};

/** App theme -> CodeMirror 5 theme name (`default` is CM's built-in). */
const CM_THEME_BY_THEME = {
  light: 'default',
  dark: 'darcula',
  sepia: 'solarized light',
  'high-contrast': 'eclipse',
  'print-optimized': 'default',
};

const prefersDark = () => {
  // matchMedia is missing in some jsdom configurations and in SSR.
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

/**
 * Turns the stored `theme` value into one of the five concrete theme names.
 * 'system' is not a palette — it is a rule for picking between two.
 */
export function resolveTheme(theme) {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light';
  return theme;
}

export function codeMirrorTheme(resolvedTheme) {
  return CM_THEME_BY_THEME[resolvedTheme] ?? 'default';
}

/**
 * Enables exactly one of the preloaded hljs stylesheets.
 *
 * All four ship in the bundle and are injected as <link> tags at startup; only
 * the `disabled` flag moves. Swapping by import at runtime would mean a network
 * round-trip on every theme change and a flash of unhighlighted code.
 */
export function toggleHljsTheme(resolvedTheme) {
  const active = HLJS_THEME_BY_THEME[resolvedTheme] ?? 'hljs-github';
  document.querySelectorAll('link[data-hljs-theme]').forEach((link) => {
    link.disabled = link.id !== active;
  });
}

export function applyTheme({
  theme,
  fontFamily,
  fontSize,
  lineHeight,
  codeFontSize,
}) {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;

  root.dataset.theme = resolved;
  root.style.setProperty(
    '--wp-font-family-body',
    `var(--wp-font-family-${fontFamily})`,
  );
  // The generics-free variant, which the per-language stacks need so they can
  // put Noto ahead of `sans-serif`. See variables.css.
  root.style.setProperty(
    '--wp-font-family-lead',
    `var(--wp-font-family-${fontFamily}-lead)`,
  );
  root.style.setProperty('--wp-font-size-base', `${fontSize}px`);
  root.style.setProperty('--wp-font-size-code', `${codeFontSize}px`);
  root.style.setProperty('--wp-line-height-base', String(lineHeight));

  toggleHljsTheme(resolved);
  return resolved;
}
