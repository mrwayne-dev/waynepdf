import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCustomThemes, {
  CUSTOM_THEMES_KEY,
  MAX_CUSTOM_THEMES,
  MAX_NAME_LENGTH,
  normalizeCustomTheme,
  loadCustomThemes,
  resolvedToken,
} from '@/App/Container/Hooks/useCustomThemes.js';
import {
  CUSTOM_THEME_STYLE_ID,
  __resetCustomThemeBases,
} from '@/App/Lib/generateCustomThemeCSS.js';
import { PRESET_PALETTES } from '@/App/Lib/presetPalettes.js';
import {
  __registeredResetNames,
  __getRegisteredReset as getRegisteredReset,
  __resetRegistryForTests,
} from '@/App/Lib/resetAll.js';

const stored = () => JSON.parse(window.localStorage.getItem(CUSTOM_THEMES_KEY));
const styleText = () =>
  document.getElementById(CUSTOM_THEME_STYLE_ID)?.textContent ?? '';

beforeEach(() => {
  window.localStorage.clear();
  __resetRegistryForTests();
  __resetCustomThemeBases();
  document.getElementById(CUSTOM_THEME_STYLE_ID)?.remove();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mount = () => renderHook(() => useCustomThemes());
const api = (r) => r.current[1];
const state = (r) => r.current[0];

describe('normalizeCustomTheme', () => {
  const ok = {
    id: 'abc',
    name: 'Mine',
    basedOn: 'dark',
    overrides: { '--wp-color-accent': '#ff0000' },
    createdAt: 5,
    updatedAt: 6,
  };

  it('passes a well-formed record through', () => {
    expect(normalizeCustomTheme(ok)).toEqual(ok);
  });

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['no id', { name: 'x' }],
    ['empty id', { id: '', name: 'x' }],
    ['no name', { id: 'a' }],
    ['blank name', { id: 'a', name: '   ' }],
  ])('drops %s', (_label, raw) => {
    expect(normalizeCustomTheme(raw)).toBeNull();
  });

  it('falls back to light for an unknown base', () => {
    expect(normalizeCustomTheme({ ...ok, basedOn: 'neon' }).basedOn).toBe(
      'light',
    );
  });

  it('truncates an over-long name', () => {
    const long = 'x'.repeat(MAX_NAME_LENGTH + 20);
    expect(normalizeCustomTheme({ ...ok, name: long }).name).toHaveLength(
      MAX_NAME_LENGTH,
    );
  });

  it('keeps only editable tokens with well-formed hex', () => {
    const result = normalizeCustomTheme({
      ...ok,
      overrides: {
        '--wp-color-accent': '#00ff00',
        '--wp-color-canvas': 'red', // not hex
        '--wp-color-canvas-subtle': '#abc', // short hex
        '--wp-color-attention': '#123456', // not editable
        'font-size': '12px', // not a token at all
      },
    });
    expect(result.overrides).toEqual({ '--wp-color-accent': '#00ff00' });
  });

  it('supplies timestamps when they are missing or junk', () => {
    const result = normalizeCustomTheme({ id: 'a', name: 'n', createdAt: 'x' });
    expect(Number.isFinite(result.createdAt)).toBe(true);
    expect(Number.isFinite(result.updatedAt)).toBe(true);
  });
});

describe('loadCustomThemes', () => {
  it('returns [] when the key is absent', () => {
    expect(loadCustomThemes()).toEqual([]);
  });

  it('returns [] for malformed JSON and for a non-array', () => {
    window.localStorage.setItem(CUSTOM_THEMES_KEY, '{not json');
    expect(loadCustomThemes()).toEqual([]);
    window.localStorage.setItem(CUSTOM_THEMES_KEY, '{"a":1}');
    expect(loadCustomThemes()).toEqual([]);
  });

  it('drops malformed entries silently and keeps the good ones', () => {
    window.localStorage.setItem(
      CUSTOM_THEMES_KEY,
      JSON.stringify([
        { id: 'good', name: 'Good', basedOn: 'dark' },
        null,
        { name: 'no id' },
        'garbage',
      ]),
    );
    const loaded = loadCustomThemes();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('good');
  });

  it('caps a bloated stored array at the limit', () => {
    const many = Array.from({ length: MAX_CUSTOM_THEMES + 5 }, (_, i) => ({
      id: `id-${i}`,
      name: `T${i}`,
      basedOn: 'light',
    }));
    window.localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(many));
    expect(loadCustomThemes()).toHaveLength(MAX_CUSTOM_THEMES);
  });

  it('survives blocked localStorage', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadCustomThemes()).toEqual([]);
  });
});

describe('resolvedToken', () => {
  it('prefers an override and otherwise reads the base', () => {
    const theme = {
      basedOn: 'dark',
      overrides: { '--wp-color-fg': '#abcdef' },
    };
    expect(resolvedToken(theme, '--wp-color-fg')).toBe('#abcdef');
    expect(resolvedToken(theme, '--wp-color-canvas')).toBe(
      PRESET_PALETTES.dark['--wp-color-canvas'],
    );
  });
});

describe('create', () => {
  it('adds, persists and generates CSS', () => {
    const { result } = mount();
    let out;
    act(() => {
      out = api(result).create({ name: 'Ocean', basedOn: 'dark' });
    });
    expect(out.ok).toBe(true);
    expect(state(result).themes).toHaveLength(1);
    expect(stored()[0].name).toBe('Ocean');
    expect(styleText()).toContain(`[data-theme="custom-${out.id}"]`);
  });

  it('generates a uuid, not a caller-supplied id', () => {
    const { result } = mount();
    let out;
    act(() => {
      out = api(result).create({ name: 'A', id: 'attacker-chosen' });
    });
    expect(out.id).not.toBe('attacker-chosen');
    expect(out.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it.each([
    ['an empty name', { name: '' }],
    ['a whitespace name', { name: '   ' }],
    ['no argument at all', undefined],
  ])('rejects %s', (_label, input) => {
    const { result } = mount();
    let out;
    act(() => {
      out = api(result).create(input);
    });
    expect(out.ok).toBe(false);
    expect(out.error).toBeTruthy();
    expect(state(result).themes).toHaveLength(0);
  });

  it('rejects a duplicate name, case-insensitively', () => {
    const { result } = mount();
    act(() => api(result).create({ name: 'Ocean' }));
    let out;
    act(() => {
      out = api(result).create({ name: 'OCEAN' });
    });
    expect(out.ok).toBe(false);
    expect(state(result).themes).toHaveLength(1);
  });

  it('enforces the limit and reports why', () => {
    const { result } = mount();
    act(() => {
      for (let i = 0; i < MAX_CUSTOM_THEMES; i += 1) {
        api(result).create({ name: `T${i}` });
      }
    });
    expect(state(result).themes).toHaveLength(MAX_CUSTOM_THEMES);
    expect(state(result).atLimit).toBe(true);

    let out;
    act(() => {
      out = api(result).create({ name: 'One too many' });
    });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/limit/i);
    expect(state(result).themes).toHaveLength(MAX_CUSTOM_THEMES);
  });
});

describe('update', () => {
  it('replaces overrides, persists and regenerates', () => {
    const { result } = mount();
    let id;
    act(() => {
      id = api(result).create({ name: 'A', basedOn: 'light' }).id;
    });
    act(() =>
      api(result).update(id, {
        overrides: { '--wp-color-accent': '#123456' },
      }),
    );
    expect(state(result).themes[0].overrides).toEqual({
      '--wp-color-accent': '#123456',
    });
    expect(stored()[0].overrides['--wp-color-accent']).toBe('#123456');
    expect(styleText()).toContain('--wp-color-accent: #123456;');
  });

  it('changes the base, and untouched tokens follow the new base', () => {
    const { result } = mount();
    let id;
    act(() => {
      id = api(result).create({ name: 'A', basedOn: 'light' }).id;
    });
    act(() => api(result).update(id, { basedOn: 'dark' }));
    expect(styleText()).toContain(
      `--wp-color-canvas: ${PRESET_PALETTES.dark['--wp-color-canvas']};`,
    );
  });

  it('rejects an unknown id, an empty name and a duplicate name', () => {
    const { result } = mount();
    let a;
    act(() => {
      a = api(result).create({ name: 'A' }).id;
      api(result).create({ name: 'B' });
    });

    let out;
    act(() => {
      out = api(result).update('nope', { name: 'X' });
    });
    expect(out.ok).toBe(false);

    act(() => {
      out = api(result).update(a, { name: '  ' });
    });
    expect(out.ok).toBe(false);

    act(() => {
      out = api(result).update(a, { name: 'b' });
    });
    expect(out.ok).toBe(false);
    expect(state(result).themes[0].name).toBe('A');
  });

  it('keeps createdAt and moves updatedAt', () => {
    const { result } = mount();
    let id;
    act(() => {
      id = api(result).create({ name: 'A' }).id;
    });
    const before = state(result).themes[0];
    act(() => api(result).update(id, { name: 'B' }));
    const after = state(result).themes[0];
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
  });

  it('lets a theme keep its own name on update', () => {
    const { result } = mount();
    let id;
    act(() => {
      id = api(result).create({ name: 'Same' }).id;
    });
    let out;
    act(() => {
      out = api(result).update(id, { name: 'Same' });
    });
    expect(out.ok).toBe(true);
  });
});

describe('remove', () => {
  it('drops from state, storage and CSS', () => {
    const { result } = mount();
    let id;
    act(() => {
      id = api(result).create({ name: 'Doomed' }).id;
    });
    expect(styleText()).toContain(`custom-${id}`);

    act(() => api(result).remove(id));
    expect(state(result).themes).toHaveLength(0);
    expect(stored()).toEqual([]);
    expect(styleText()).not.toContain(`custom-${id}`);
  });

  it('removing an unknown id changes nothing', () => {
    const { result } = mount();
    act(() => api(result).create({ name: 'Keep' }));
    act(() => api(result).remove('nope'));
    expect(state(result).themes).toHaveLength(1);
  });
});

describe('persistence and reset', () => {
  it('rehydrates on mount and applies the CSS immediately', () => {
    window.localStorage.setItem(
      CUSTOM_THEMES_KEY,
      JSON.stringify([{ id: 'seeded', name: 'Seeded', basedOn: 'sepia' }]),
    );
    const { result } = mount();
    expect(state(result).themes[0].name).toBe('Seeded');
    // Synchronous, not in an effect: a custom theme could otherwise be selected
    // before its palette existed.
    expect(styleText()).toContain('[data-theme="custom-seeded"]');
  });

  it('registers its reset and clears in-memory state', () => {
    const { result, unmount } = mount();
    act(() => api(result).create({ name: 'Temp' }));
    expect(__registeredResetNames()).toContain('customThemes');

    act(() => getRegisteredReset('customThemes')());
    expect(state(result).themes).toEqual([]);
    expect(styleText()).toBe('');

    unmount();
    expect(__registeredResetNames()).not.toContain('customThemes');
  });
});
