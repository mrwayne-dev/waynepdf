import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTheme from '../../src/App/Container/Hooks/useTheme.js';
import { DEFAULTS, STORAGE_KEY } from '../../src/App/Lib/settings.js';

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.removeAttribute('style');
});

const read = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY));

describe('useTheme', () => {
  it('starts from defaults when storage is empty', () => {
    const { result } = renderHook(() => useTheme());
    const [settings] = result.current;
    expect(settings).toMatchObject(DEFAULTS);
  });

  it('exposes the resolved theme alongside the stored one', () => {
    const { result } = renderHook(() => useTheme());
    const [settings] = result.current;
    // The stub reports prefers-color-scheme: dark as false.
    expect(settings.theme).toBe('system');
    expect(settings.resolvedTheme).toBe('light');
  });

  it('rehydrates from localStorage on mount', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULTS, theme: 'sepia', fontSize: 21 }),
    );
    const { result } = renderHook(() => useTheme());
    const [settings] = result.current;
    expect(settings.theme).toBe('sepia');
    expect(settings.fontSize).toBe(21);
  });

  it('applies the theme to the document on mount', () => {
    renderHook(() => useTheme());
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it.each([
    ['setTheme', 'dark', 'theme', 'dark'],
    ['setFontFamily', 'mono', 'fontFamily', 'mono'],
    ['setFontSize', 20, 'fontSize', 20],
    ['setLineHeight', 1.85, 'lineHeight', 1.85],
    ['setCodeFontSize', 18, 'codeFontSize', 18],
  ])('%s updates state and persists', (updater, value, key, expected) => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1][updater](value));
    expect(result.current[0][key]).toBe(expected);
    expect(read()[key]).toBe(expected);
  });

  it('validates through the updaters, so a bad value cannot enter state', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1].setFontSize(999));
    expect(result.current[0].fontSize).toBe(DEFAULTS.fontSize);
    act(() => result.current[1].setTheme('neon'));
    expect(result.current[0].theme).toBe(DEFAULTS.theme);
  });

  it('writes data-theme when the theme changes', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1].setTheme('high-contrast'));
    expect(document.documentElement.dataset.theme).toBe('high-contrast');
  });

  it('reset returns every field to its default and persists that', () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current[1].setTheme('dark');
      result.current[1].setFontSize(24);
      result.current[1].setLineHeight(2.0);
      result.current[1].setCodeFontSize(20);
      result.current[1].setFontFamily('serif');
    });
    expect(result.current[0]).toMatchObject({ theme: 'dark', fontSize: 24 });

    act(() => result.current[1].reset());
    expect(result.current[0]).toMatchObject(DEFAULTS);
    expect(read()).toEqual(DEFAULTS);
  });

  it('keeps updater identities stable across renders', () => {
    const { result, rerender } = renderHook(() => useTheme());
    const first = result.current[1];
    rerender();
    expect(result.current[1]).toBe(first);
  });
});
