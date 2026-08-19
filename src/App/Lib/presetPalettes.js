/*
 * The five preset palettes, as JS.
 *
 * This duplicates src/styles/theme/*.css. The duplication is deliberate but not
 * free: custom themes are "a preset plus overrides", so the generator has to be
 * able to read a preset's full token set, and CSS custom properties cannot be
 * enumerated from a stylesheet the browser has not matched. Extracting them at
 * build time would need a plugin for one consumer.
 *
 * TRANSCRIBED, NOT AUTHORED — these values were generated from the CSS with a
 * script, so they match at the time of writing. A palette edit must be made in
 * both places; `pnpm test` has a guard (tests/unit/presetPalettes.test.js) that
 * reads the CSS and fails when the two drift. Consolidating the two into one
 * source is Phase 7 work.
 */

export const PRESET_NAMES = [
  'light',
  'dark',
  'sepia',
  'high-contrast',
  'print-optimized',
];

/**
 * Tokens the custom-theme editor exposes.
 *
 * Eight of the fifteen. The rest — accent-emphasis, border-muted,
 * neutral-muted, fg-subtle, attention, and the two blockquote tokens — are
 * derived or situational, and putting them in the picker would trade a
 * manageable form for a wall of colour inputs nobody wants to fill in.
 */
export const EDITABLE_TOKENS = [
  '--wp-color-canvas',
  '--wp-color-canvas-subtle',
  '--wp-color-fg',
  '--wp-color-fg-muted',
  '--wp-color-accent',
  '--wp-color-border',
  '--wp-color-danger',
  '--wp-color-success',
];

/** Human labels for the editable tokens, in EDITABLE_TOKENS order. */
export const TOKEN_LABELS = {
  '--wp-color-canvas': 'Background',
  '--wp-color-canvas-subtle': 'Surface',
  '--wp-color-fg': 'Text',
  '--wp-color-fg-muted': 'Muted text',
  '--wp-color-accent': 'Accent',
  '--wp-color-border': 'Border',
  '--wp-color-danger': 'Danger',
  '--wp-color-success': 'Success',
};

export const PRESET_PALETTES = {
  light: {
    '--wp-color-canvas': '#ffffff',
    '--wp-color-canvas-subtle': '#f6f8fa',
    '--wp-color-fg': '#1f2328',
    '--wp-color-fg-muted': '#59636e',
    '--wp-color-fg-subtle': '#6e7781',
    '--wp-color-accent': '#0969da',
    '--wp-color-accent-emphasis': '#0550ae',
    '--wp-color-border': '#d1d9e0',
    '--wp-color-border-muted': '#d1d9e0b3',
    '--wp-color-neutral-muted': '#818b981f',
    '--wp-color-danger': '#d1242f',
    '--wp-color-success': '#1a7f37',
    '--wp-color-attention': '#9a6700',
    '--wp-color-blockquote-fg': '#59636e',
    '--wp-color-blockquote-border': '#d1d9e0',
  },
  dark: {
    '--wp-color-canvas': '#0d1117',
    '--wp-color-canvas-subtle': '#151b23',
    '--wp-color-fg': '#f0f6fc',
    '--wp-color-fg-muted': '#9198a1',
    '--wp-color-fg-subtle': '#6e7681',
    '--wp-color-accent': '#4493f8',
    '--wp-color-accent-emphasis': '#1f6feb',
    '--wp-color-border': '#3d444d',
    '--wp-color-border-muted': '#3d444db3',
    '--wp-color-neutral-muted': '#656c7633',
    '--wp-color-danger': '#f85149',
    '--wp-color-success': '#3fb950',
    '--wp-color-attention': '#d29922',
    '--wp-color-blockquote-fg': '#9198a1',
    '--wp-color-blockquote-border': '#3d444d',
  },
  sepia: {
    '--wp-color-canvas': '#f4ecd8',
    '--wp-color-canvas-subtle': '#ebe0c4',
    '--wp-color-fg': '#433422',
    '--wp-color-fg-muted': '#6b5a44',
    '--wp-color-fg-subtle': '#8b7a5f',
    '--wp-color-accent': '#8b4513',
    '--wp-color-accent-emphasis': '#6b3410',
    '--wp-color-border': '#c9b98a',
    '--wp-color-border-muted': '#c9b98ab3',
    '--wp-color-neutral-muted': '#a8996855',
    '--wp-color-danger': '#a03030',
    '--wp-color-success': '#4a7c2e',
    '--wp-color-attention': '#a06b1a',
    '--wp-color-blockquote-fg': '#6b5a44',
    '--wp-color-blockquote-border': '#c9b98a',
  },
  'high-contrast': {
    '--wp-color-canvas': '#ffffff',
    '--wp-color-canvas-subtle': '#f0f0f0',
    '--wp-color-fg': '#000000',
    '--wp-color-fg-muted': '#1a1a1a',
    '--wp-color-fg-subtle': '#333333',
    '--wp-color-accent': '#0000ee',
    '--wp-color-accent-emphasis': '#000099',
    '--wp-color-border': '#000000',
    '--wp-color-border-muted': '#333333',
    '--wp-color-neutral-muted': '#e0e0e0',
    '--wp-color-danger': '#a00000',
    '--wp-color-success': '#006000',
    '--wp-color-attention': '#805000',
    '--wp-color-blockquote-fg': '#000000',
    '--wp-color-blockquote-border': '#000000',
  },
  'print-optimized': {
    '--wp-color-canvas': '#ffffff',
    '--wp-color-canvas-subtle': '#f4f4f4',
    '--wp-color-fg': '#000000',
    '--wp-color-fg-muted': '#333333',
    '--wp-color-fg-subtle': '#555555',
    '--wp-color-accent': '#003399',
    '--wp-color-accent-emphasis': '#001a66',
    '--wp-color-border': '#666666',
    '--wp-color-border-muted': '#999999',
    '--wp-color-neutral-muted': '#eeeeee',
    '--wp-color-danger': '#990000',
    '--wp-color-success': '#006600',
    '--wp-color-attention': '#996600',
    '--wp-color-blockquote-fg': '#333333',
    '--wp-color-blockquote-border': '#666666',
  },
};
