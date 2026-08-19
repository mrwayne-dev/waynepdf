import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateCustomThemeCSS,
  applyCustomThemeCSS,
  mergedPalette,
  customThemeId,
  isCustomTheme,
  basePresetFor,
  CUSTOM_THEME_STYLE_ID,
  __resetCustomThemeBases,
} from '@/App/Lib/generateCustomThemeCSS.js';
import { PRESET_PALETTES } from '@/App/Lib/presetPalettes.js';

const theme = (over = {}) => ({
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  name: 'Mine',
  basedOn: 'dark',
  overrides: {},
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

beforeEach(() => {
  __resetCustomThemeBases();
  document.getElementById(CUSTOM_THEME_STYLE_ID)?.remove();
});

describe('mergedPalette', () => {
  it('is the base preset when there are no overrides', () => {
    expect(mergedPalette(theme({ basedOn: 'sepia' }))).toEqual(
      PRESET_PALETTES.sepia,
    );
  });

  it('applies overrides over the base', () => {
    const merged = mergedPalette(
      theme({ overrides: { '--wp-color-accent': '#ff00ff' } }),
    );
    expect(merged['--wp-color-accent']).toBe('#ff00ff');
    // Untouched tokens still track the base.
    expect(merged['--wp-color-canvas']).toBe(
      PRESET_PALETTES.dark['--wp-color-canvas'],
    );
  });

  it('falls back to light for an unknown base rather than throwing', () => {
    expect(mergedPalette(theme({ basedOn: 'nonsense' }))).toEqual(
      PRESET_PALETTES.light,
    );
    expect(() => mergedPalette(null)).not.toThrow();
    expect(mergedPalette(undefined)).toEqual(PRESET_PALETTES.light);
  });

  it('ignores a non-object overrides field', () => {
    expect(mergedPalette(theme({ overrides: 'nope' }))).toEqual(
      PRESET_PALETTES.dark,
    );
  });
});

describe('generateCustomThemeCSS', () => {
  it('is empty for no themes', () => {
    expect(generateCustomThemeCSS([])).toBe('');
    expect(generateCustomThemeCSS(null)).toBe('');
    expect(generateCustomThemeCSS(undefined)).toBe('');
  });

  it('emits a data-theme block keyed on custom-{id}', () => {
    const css = generateCustomThemeCSS([theme()]);
    expect(css).toContain(
      '[data-theme="custom-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"]',
    );
  });

  it('emits the FULL merged palette, not only the overrides', () => {
    /*
     * A partial block would inherit the rest from :root, which carries the Light
     * fallback — so a Dark-based theme would come out with Light's borders
     * wherever the user had not set a colour.
     */
    const css = generateCustomThemeCSS([
      theme({ overrides: { '--wp-color-accent': '#ff00ff' } }),
    ]);
    for (const token of Object.keys(PRESET_PALETTES.dark)) {
      expect(css, `${token} missing`).toContain(`${token}:`);
    }
    expect(css).toContain('--wp-color-accent: #ff00ff;');
    expect(css).toContain(
      `--wp-color-canvas: ${PRESET_PALETTES.dark['--wp-color-canvas']};`,
    );
  });

  it('emits one block per theme', () => {
    const css = generateCustomThemeCSS([
      theme({ id: 'one' }),
      theme({ id: 'two' }),
    ]);
    expect(css).toContain('[data-theme="custom-one"]');
    expect(css).toContain('[data-theme="custom-two"]');
    expect(css.match(/\[data-theme="custom-/g)).toHaveLength(2);
  });
});

describe('applyCustomThemeCSS', () => {
  it('creates the style element once and rewrites it in place', () => {
    applyCustomThemeCSS([theme()]);
    const first = document.getElementById(CUSTOM_THEME_STYLE_ID);
    expect(first).toBeTruthy();
    expect(first.textContent).toContain('custom-');

    applyCustomThemeCSS([]);
    const second = document.getElementById(CUSTOM_THEME_STYLE_ID);
    // Same node — swapping textContent is atomic, where remove-and-re-add
    // would flash the page through an unstyled state.
    expect(second).toBe(first);
    expect(second.textContent).toBe('');
    expect(document.querySelectorAll(`#${CUSTOM_THEME_STYLE_ID}`)).toHaveLength(
      1,
    );
  });
});

describe('base preset lookup', () => {
  it('passes preset names straight through', () => {
    for (const name of ['light', 'dark', 'sepia', 'system']) {
      expect(basePresetFor(name)).toBe(name);
    }
  });

  it('maps a custom theme to the preset it was built on', () => {
    // Needed because there is no highlight.js or CodeMirror theme for
    // `custom-*`; without it a Dark-based custom theme gets a light highlighter.
    applyCustomThemeCSS([theme({ id: 'x', basedOn: 'dark' })]);
    expect(basePresetFor('custom-x')).toBe('dark');
  });

  it('falls back to light for an unknown custom id', () => {
    expect(basePresetFor('custom-never-registered')).toBe('light');
  });

  it('falls back to light when the stored base is not a preset', () => {
    applyCustomThemeCSS([theme({ id: 'y', basedOn: 'nonsense' })]);
    expect(basePresetFor('custom-y')).toBe('light');
  });

  it('handles non-strings without throwing', () => {
    for (const value of [null, undefined, 42, {}]) {
      expect(() => basePresetFor(value)).not.toThrow();
    }
  });
});

describe('helpers', () => {
  it('customThemeId prefixes', () => {
    expect(customThemeId('abc')).toBe('custom-abc');
  });

  it('isCustomTheme only matches the prefix', () => {
    expect(isCustomTheme('custom-abc')).toBe(true);
    expect(isCustomTheme('dark')).toBe(false);
    expect(isCustomTheme('system')).toBe(false);
    expect(isCustomTheme(null)).toBe(false);
  });
});
