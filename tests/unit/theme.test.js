import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  applyTheme,
  resolveTheme,
  toggleHljsTheme,
  codeMirrorTheme,
} from '../../src/App/Lib/applyTheme.js';
import {
  DEFAULTS,
  THEMES,
  STORAGE_KEY,
  loadSettings,
  saveSettings,
  normalizeSettings,
} from '../../src/App/Lib/settings.js';

const CONCRETE = THEMES.filter((t) => t !== 'system');

/** Point the matchMedia stub at a given prefers-color-scheme outcome. */
function mockPrefersDark(matches) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query.includes('dark') ? matches : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.removeAttribute('style');
  document.head
    .querySelectorAll('link[data-hljs-theme]')
    .forEach((l) => l.remove());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveTheme', () => {
  it.each(CONCRETE)('passes %s through unchanged', (theme) => {
    expect(resolveTheme(theme)).toBe(theme);
  });

  it('resolves system to dark when the OS prefers dark', () => {
    mockPrefersDark(true);
    expect(resolveTheme('system')).toBe('dark');
  });

  it('resolves system to light when the OS prefers light', () => {
    mockPrefersDark(false);
    expect(resolveTheme('system')).toBe('light');
  });
});

describe('applyTheme', () => {
  it.each(CONCRETE)('sets data-theme to %s', (theme) => {
    applyTheme({ ...DEFAULTS, theme });
    expect(document.documentElement.dataset.theme).toBe(theme);
  });

  it('writes data-theme as the resolved value for system, never "system"', () => {
    mockPrefersDark(true);
    applyTheme({ ...DEFAULTS, theme: 'system' });
    expect(document.documentElement.dataset.theme).toBe('dark');

    mockPrefersDark(false);
    applyTheme({ ...DEFAULTS, theme: 'system' });
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('writes the typography custom properties', () => {
    applyTheme({
      theme: 'light',
      fontFamily: 'serif',
      fontSize: 20,
      lineHeight: 1.8,
      codeFontSize: 12,
    });
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--wp-font-family-body')).toBe(
      'var(--wp-font-family-serif)',
    );
    expect(style.getPropertyValue('--wp-font-size-base')).toBe('20px');
    expect(style.getPropertyValue('--wp-line-height-base')).toBe('1.8');
    expect(style.getPropertyValue('--wp-font-size-code')).toBe('12px');
  });

  it('points the body font at whichever family is active', () => {
    for (const family of ['sans', 'serif', 'mono']) {
      applyTheme({ ...DEFAULTS, theme: 'light', fontFamily: family });
      expect(
        document.documentElement.style.getPropertyValue(
          '--wp-font-family-body',
        ),
      ).toBe(`var(--wp-font-family-${family})`);
    }
  });

  it('returns the resolved theme name', () => {
    mockPrefersDark(true);
    expect(applyTheme({ ...DEFAULTS, theme: 'system' })).toBe('dark');
    expect(applyTheme({ ...DEFAULTS, theme: 'sepia' })).toBe('sepia');
  });
});

describe('toggleHljsTheme', () => {
  const IDS = [
    'hljs-github',
    'hljs-github-dark',
    'hljs-atom-one-light',
    'hljs-vs',
  ];

  beforeEach(() => {
    for (const id of IDS) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.id = id;
      link.dataset.hljsTheme = '';
      link.disabled = true;
      document.head.appendChild(link);
    }
  });

  const enabled = () =>
    IDS.filter((id) => !document.getElementById(id).disabled);

  it.each([
    ['light', 'hljs-github'],
    ['dark', 'hljs-github-dark'],
    ['sepia', 'hljs-atom-one-light'],
    ['high-contrast', 'hljs-vs'],
    ['print-optimized', 'hljs-github'],
  ])('enables only %s -> %s', (theme, expectedId) => {
    toggleHljsTheme(theme);
    expect(enabled()).toEqual([expectedId]);
  });

  it('leaves exactly one sheet enabled after repeated switches', () => {
    toggleHljsTheme('dark');
    toggleHljsTheme('sepia');
    toggleHljsTheme('light');
    expect(enabled()).toHaveLength(1);
  });
});

describe('codeMirrorTheme', () => {
  it.each([
    ['light', 'default'],
    ['dark', 'darcula'],
    ['sepia', 'solarized light'],
    ['high-contrast', 'eclipse'],
    ['print-optimized', 'default'],
  ])('maps %s -> %s', (theme, cm) => {
    expect(codeMirrorTheme(theme)).toBe(cm);
  });

  it('falls back to default for an unknown theme', () => {
    expect(codeMirrorTheme('nope')).toBe('default');
  });
});

describe('normalizeSettings', () => {
  it('returns defaults for a non-object', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULTS);
    expect(normalizeSettings('nope')).toEqual(DEFAULTS);
    expect(normalizeSettings(undefined)).toEqual(DEFAULTS);
  });

  it('rejects an unknown theme name', () => {
    expect(normalizeSettings({ theme: 'neon' }).theme).toBe(DEFAULTS.theme);
  });

  it('rejects an unknown font family', () => {
    expect(normalizeSettings({ fontFamily: 'comic' }).fontFamily).toBe(
      DEFAULTS.fontFamily,
    );
  });

  it.each([
    ['fontSize', 999, DEFAULTS.fontSize],
    ['fontSize', 4, DEFAULTS.fontSize],
    ['fontSize', '16', DEFAULTS.fontSize],
    ['lineHeight', 9, DEFAULTS.lineHeight],
    ['lineHeight', 0.2, DEFAULTS.lineHeight],
    ['codeFontSize', 100, DEFAULTS.codeFontSize],
    ['codeFontSize', NaN, DEFAULTS.codeFontSize],
  ])('clamps out-of-range %s=%s to the default', (key, value, expected) => {
    expect(normalizeSettings({ [key]: value })[key]).toBe(expected);
  });

  it.each([
    ['fontSize', 12],
    ['fontSize', 24],
    ['lineHeight', 1.2],
    ['lineHeight', 2.0],
    ['codeFontSize', 10],
    ['codeFontSize', 20],
  ])('accepts %s=%s at the range boundary', (key, value) => {
    expect(normalizeSettings({ [key]: value })[key]).toBe(value);
  });

  it('keeps valid fields when a sibling field is invalid', () => {
    const result = normalizeSettings({ theme: 'dark', fontSize: 999 });
    expect(result.theme).toBe('dark');
    expect(result.fontSize).toBe(DEFAULTS.fontSize);
  });
});

describe('loadSettings', () => {
  it('returns defaults when the key is missing', () => {
    expect(loadSettings()).toEqual(DEFAULTS);
  });

  it('returns the stored value when it is valid', () => {
    const stored = {
      theme: 'sepia',
      fontFamily: 'serif',
      fontSize: 18,
      lineHeight: 1.75,
      codeFontSize: 16,
      mathCopyEnabled: false,
      sanitizeHtml: true,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    expect(loadSettings()).toEqual(stored);
  });

  it('fills in a field added after the payload was written', () => {
    // Schema evolution within v1: mathCopyEnabled arrived in Phase 4, so any
    // payload written before it must come back with the default rather than
    // undefined. This is why the key does not need a v2 bump.
    const legacy = {
      theme: 'dark',
      fontFamily: 'mono',
      fontSize: 18,
      lineHeight: 1.75,
      codeFontSize: 16,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    // Two fields have been added inside v1 now (Phase 4's mathCopyEnabled and
    // Phase 6a's sanitizeHtml); both must appear with their defaults.
    expect(loadSettings()).toEqual({
      ...legacy,
      mathCopyEnabled: true,
      sanitizeHtml: false,
    });
  });

  it('rejects a non-boolean mathCopyEnabled', () => {
    expect(normalizeSettings({ mathCopyEnabled: 'yes' }).mathCopyEnabled).toBe(
      true,
    );
    expect(normalizeSettings({ mathCopyEnabled: false }).mathCopyEnabled).toBe(
      false,
    );
  });

  it('returns defaults for malformed JSON, and overwrites the bad value', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json at all');
    expect(loadSettings()).toEqual(DEFAULTS);
    // The landmine is cleared rather than left for the next load.
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY))).toEqual(
      DEFAULTS,
    );
  });

  it('returns defaults for valid JSON of the wrong shape', () => {
    window.localStorage.setItem(STORAGE_KEY, '[1,2,3]');
    expect(loadSettings()).toEqual(DEFAULTS);
  });

  it('does not throw when localStorage access is blocked', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => loadSettings()).not.toThrow();
    expect(loadSettings()).toEqual(DEFAULTS);
  });
});

describe('saveSettings', () => {
  it('round-trips through loadSettings', () => {
    const settings = { ...DEFAULTS, theme: 'high-contrast', fontSize: 22 };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  it('uses exactly one storage key', () => {
    saveSettings(DEFAULTS);
    expect(Object.keys(window.localStorage)).toEqual([STORAGE_KEY]);
    expect(STORAGE_KEY).toBe('waynepdf.settings.v1');
  });

  it('does not throw when the quota is exhausted', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveSettings(DEFAULTS)).not.toThrow();
  });
});
