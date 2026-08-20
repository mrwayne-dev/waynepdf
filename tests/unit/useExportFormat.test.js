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
import {
  isFormatAvailable,
  effectiveFormat,
} from '@/App/Lib/exportRegistry.js';

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

  it('acts on docx now that the format is wired', () => {
    /*
     * Through 6d.1 this asserted the opposite — docx stored but acting as pdf,
     * because the format was named in the menu before it was written. 6d.2 wired
     * it, so stored and effective agree again. The degradation mechanism itself
     * is still exercised below through an unknown value.
     */
    const { result } = mount();
    act(() => api(result).setFormat('docx'));
    expect(state(result).stored).toBe('docx');
    expect(state(result).format).toBe('docx');
    expect(state(result).available).toBe(true);
    expect(stored()).toBe('docx');
  });

  it('every declared format is available', () => {
    // If a future format is added but not wired, the menu must say so rather
    // than dispatching into nothing.
    for (const format of ['pdf', 'html', 'docx']) {
      expect(isFormatAvailable(format), `${format}`).toBe(true);
    }
  });

  it('an unavailable format would still degrade to pdf without losing the choice', () => {
    // The mechanism, tested directly: nothing is unavailable today, so the hook
    // cannot demonstrate it end to end.
    expect(effectiveFormat('pdf')).toBe('pdf');
    expect(effectiveFormat('not-a-format')).toBe('pdf');
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
