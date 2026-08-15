import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import useLanguage, {
  LANGUAGE_STORAGE_KEY,
  DEFAULT_LANG_SETTINGS,
  normalizeLanguageSettings,
  directionForLang,
} from '../../src/App/Container/Hooks/useLanguage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (name) =>
  fs.readFileSync(path.resolve(__dirname, '../fixtures', name), 'utf8');

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

const stored = () =>
  JSON.parse(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));

describe('normalizeLanguageSettings', () => {
  it('returns defaults for a non-object', () => {
    expect(normalizeLanguageSettings(null)).toEqual(DEFAULT_LANG_SETTINGS);
    expect(normalizeLanguageSettings('nope')).toEqual(DEFAULT_LANG_SETTINGS);
  });

  it('rejects an unknown language', () => {
    expect(normalizeLanguageSettings({ lang: 'klingon' }).lang).toBe('auto');
  });

  it('rejects an unknown direction', () => {
    expect(normalizeLanguageSettings({ direction: 'sideways' }).direction).toBe(
      'auto',
    );
  });

  it('keeps a valid field when its sibling is invalid', () => {
    expect(
      normalizeLanguageSettings({ lang: 'ja', direction: 'nope' }),
    ).toEqual({ lang: 'ja', direction: 'auto' });
  });
});

describe('directionForLang', () => {
  it.each([
    ['ar', 'rtl'],
    ['he', 'rtl'],
    ['en', 'ltr'],
    ['ja', 'ltr'],
    ['zh-Hant', 'ltr'],
    ['und', 'ltr'],
  ])('%s -> %s', (lang, dir) => {
    expect(directionForLang(lang)).toBe(dir);
  });
});

describe('useLanguage', () => {
  it('starts from defaults when storage is empty', () => {
    const { result } = renderHook(() => useLanguage());
    expect(result.current[0]).toMatchObject(DEFAULT_LANG_SETTINGS);
  });

  it('rehydrates from localStorage on mount', () => {
    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      JSON.stringify({ lang: 'ja', direction: 'ltr' }),
    );
    const { result } = renderHook(() => useLanguage());
    expect(result.current[0]).toMatchObject({ lang: 'ja', direction: 'ltr' });
  });

  it('falls back to defaults on malformed JSON without throwing', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, '{broken');
    const { result } = renderHook(() => useLanguage());
    expect(result.current[0]).toMatchObject(DEFAULT_LANG_SETTINGS);
  });

  it('persists a language change', () => {
    const { result } = renderHook(() => useLanguage());
    act(() => result.current[1].setLang('ko'));
    expect(result.current[0].lang).toBe('ko');
    expect(stored().lang).toBe('ko');
  });

  it('persists a direction change', () => {
    const { result } = renderHook(() => useLanguage());
    act(() => result.current[1].setDirection('rtl'));
    expect(result.current[0].direction).toBe('rtl');
    expect(stored().direction).toBe('rtl');
  });

  it('rejects invalid values through the updaters', () => {
    const { result } = renderHook(() => useLanguage());
    act(() => result.current[1].setLang('klingon'));
    expect(result.current[0].lang).toBe('auto');
  });

  it('reset returns both fields to defaults', () => {
    const { result } = renderHook(() => useLanguage());
    act(() => {
      result.current[1].setLang('he');
      result.current[1].setDirection('ltr');
    });
    act(() => result.current[1].reset());
    expect(result.current[0]).toMatchObject(DEFAULT_LANG_SETTINGS);
  });

  it('writes its own storage key, separate from theme settings', () => {
    const { result } = renderHook(() => useLanguage());
    act(() => result.current[1].setLang('ar'));
    expect(Object.keys(window.localStorage)).toEqual([LANGUAGE_STORAGE_KEY]);
    expect(LANGUAGE_STORAGE_KEY).toBe('waynepdf.language.v1');
  });
});

describe('useLanguage: detection', () => {
  it('detectNow applies immediately', () => {
    const { result } = renderHook(() => useLanguage());
    act(() => result.current[1].detectNow(read('cjk-ja.md')));
    expect(result.current[0].detectedLang).toBe('ja');
    expect(result.current[0].resolvedLang).toBe('ja');
  });

  it('observeText is debounced, not immediate', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLanguage());
    act(() => result.current[1].observeText(read('cjk-ko.md')));
    // Nothing yet: the whole point is that typing does not rescan per keystroke.
    expect(result.current[0].detectedLang).toBe('und');

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current[0].detectedLang).toBe('ko');
  });

  it('coalesces rapid observeText calls into one detection', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLanguage());
    act(() => {
      result.current[1].observeText('a');
      result.current[1].observeText('ab');
      result.current[1].observeText(read('rtl-arabic.md'));
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current[0].detectedLang).toBe('ar');
  });

  it('resolves direction from the detected language in auto mode', () => {
    const { result } = renderHook(() => useLanguage());
    act(() => result.current[1].detectNow(read('rtl-hebrew.md')));
    expect(result.current[0].resolvedLang).toBe('he');
    expect(result.current[0].resolvedDirection).toBe('rtl');
  });

  it('a user language choice overrides detection', () => {
    const { result } = renderHook(() => useLanguage());
    act(() => result.current[1].detectNow(read('cjk-tc.md')));
    expect(result.current[0].resolvedLang).toBe('zh-Hant');

    act(() => result.current[1].setLang('ja'));
    expect(result.current[0].resolvedLang).toBe('ja');
    // Detection keeps running so the panel can still show what it found.
    expect(result.current[0].detectedLang).toBe('zh-Hant');
  });

  it('a user direction choice overrides the language default', () => {
    const { result } = renderHook(() => useLanguage());
    act(() => result.current[1].detectNow(read('rtl-arabic.md')));
    expect(result.current[0].resolvedDirection).toBe('rtl');

    act(() => result.current[1].setDirection('ltr'));
    expect(result.current[0].resolvedDirection).toBe('ltr');
  });

  it('exposes the breakdown for the panel readout', async () => {
    const { result } = renderHook(() => useLanguage());
    act(() => result.current[1].detectNow(read('cjk-ja.md')));
    await waitFor(() =>
      expect(result.current[0].breakdown.kana).toBeGreaterThan(0),
    );
  });

  it('keeps action identities stable across renders', () => {
    const { result, rerender } = renderHook(() => useLanguage());
    const first = result.current[1];
    rerender();
    expect(result.current[1]).toBe(first);
  });
});
