import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRESET_PALETTES,
  PRESET_NAMES,
  EDITABLE_TOKENS,
  TOKEN_LABELS,
} from '@/App/Lib/presetPalettes.js';

/*
 * The drift guard.
 *
 * presetPalettes.js duplicates src/styles/theme/*.css because custom themes are
 * "a preset plus overrides" and the generator needs a preset's whole token set.
 * Duplication without a guard is how two sources of truth quietly disagree, so
 * this test reads the CSS and compares.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THEME_DIR = path.resolve(__dirname, '../../src/styles/theme');

/** Every --wp-color-* declaration in a theme stylesheet. */
function tokensFromCSS(name) {
  const css = fs.readFileSync(path.join(THEME_DIR, `${name}.css`), 'utf8');
  const out = {};
  for (const [, token, value] of css.matchAll(
    /(--wp-color-[a-z-]+):\s*([^;]+);/g,
  )) {
    out[token] = value.trim();
  }
  return out;
}

describe('preset palettes match the stylesheets', () => {
  it.each(PRESET_NAMES)('%s is identical to its CSS', (name) => {
    expect(PRESET_PALETTES[name]).toEqual(tokensFromCSS(name));
  });

  it('covers exactly the five presets, and no others', () => {
    expect(Object.keys(PRESET_PALETTES).sort()).toEqual(
      [...PRESET_NAMES].sort(),
    );
    // 'system' is a resolution mode, not a palette; it must not appear here.
    expect(PRESET_PALETTES.system).toBeUndefined();
  });
});

describe('editable token set', () => {
  it('is eight tokens', () => {
    expect(EDITABLE_TOKENS).toHaveLength(8);
  });

  it('every editable token exists in every preset', () => {
    for (const name of PRESET_NAMES) {
      for (const token of EDITABLE_TOKENS) {
        expect(
          PRESET_PALETTES[name][token],
          `${name} is missing ${token}`,
        ).toBeTruthy();
      }
    }
  });

  it('every editable token has a label', () => {
    for (const token of EDITABLE_TOKENS) {
      expect(TOKEN_LABELS[token], `${token} has no label`).toBeTruthy();
    }
    expect(Object.keys(TOKEN_LABELS).sort()).toEqual(
      [...EDITABLE_TOKENS].sort(),
    );
  });

  it('every editable token is a plain hex colour in every preset', () => {
    // The editor uses <input type="color">, which only accepts #rrggbb. A token
    // carrying alpha (border-muted, neutral-muted) could not round-trip, which
    // is part of why those are not editable.
    for (const name of PRESET_NAMES) {
      for (const token of EDITABLE_TOKENS) {
        expect(PRESET_PALETTES[name][token], `${name} ${token}`).toMatch(
          /^#[0-9a-f]{6}$/i,
        );
      }
    }
  });
});
