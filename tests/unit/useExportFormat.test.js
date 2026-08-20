import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useExportFormat, {
  EXPORT_FORMAT_KEY,
  DEFAULT_FORMAT,
  normalizeFormat,
} from '@/App/Container/Hooks/useExportFormat.js';
import {
  __registeredResetNames,
  __getRegisteredReset as getRegisteredReset,
  __resetRegistryForTests,
} from '@/App/Lib/resetAll.js';

beforeEach(() => {
  window.localStorage.clear();
  __resetRegistryForTests();
});

const stored = () => window.localStorage.getItem(EXPORT_FORMAT_KEY);
const mount = () => renderHook(() => useExportFormat());
const state = (r) => r.current[0];
const api = (r) => r.current[1];

describe('normalizeFormat', () => {
  it.each(['pdf', 'html', 'docx'])('accepts %s', (value) => {
    expect(normalizeFormat(value)).toBe(value);
  });

  it.each([['nonsense'], [null], [undefined], [42], ['PDF']])(
    'falls back to the default for %s',
    (value) => {
      expect(normalizeFormat(value)).toBe(DEFAULT_FORMAT);
    },
  );
});

describe('useExportFormat', () => {
  it('defaults to pdf', () => {
    const { result } = mount();
    expect(state(result).format).toBe('pdf');
    expect(state(result).stored).toBe('pdf');
  });

  it('persists a chosen format and reads it back', () => {
    const { result, unmount } = mount();
    act(() => api(result).setFormat('html'));
    expect(state(result).format).toBe('html');
    expect(stored()).toBe('html');

    unmount();
    const second = mount();
    expect(state(second.result).format).toBe('html');
  });

  it('stores docx but acts on pdf until the format is wired', () => {
    /*
     * The preference and the action deliberately diverge. Overwriting the stored
     * value would silently discard what the user asked for the moment 6d.2
     * lands; refusing to store it would make the menu forget the choice.
     */
    const { result } = mount();
    act(() => api(result).setFormat('docx'));
    expect(state(result).stored).toBe('docx');
    expect(state(result).format).toBe('pdf');
    expect(state(result).available).toBe(false);
    expect(stored()).toBe('docx');
  });

  it('ignores an invalid setter argument', () => {
    const { result } = mount();
    act(() => api(result).setFormat('exe'));
    expect(state(result).format).toBe('pdf');
  });

  it('falls back to the default for a junk stored value', () => {
    window.localStorage.setItem(EXPORT_FORMAT_KEY, 'garbage');
    const { result } = mount();
    expect(state(result).format).toBe('pdf');
  });

  it('survives blocked localStorage', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const { result } = mount();
    expect(state(result).format).toBe('pdf');
    vi.restoreAllMocks();
  });

  it('registers its reset and returns to the default', () => {
    const { result, unmount } = mount();
    act(() => api(result).setFormat('html'));
    expect(__registeredResetNames()).toContain('exportFormat');

    act(() => getRegisteredReset('exportFormat')());
    expect(state(result).format).toBe('pdf');

    unmount();
    expect(__registeredResetNames()).not.toContain('exportFormat');
  });
});
