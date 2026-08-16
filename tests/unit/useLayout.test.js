import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useLayout, {
  DEFAULTS,
  LAYOUT_STORAGE_KEY,
  MARGIN_PRESETS,
  normalizeLayout,
  resolveMargins,
  resolvePageSize,
  loadLayout,
} from '@/App/Container/Hooks/useLayout.js';
import {
  __registeredResetNames,
  __getRegisteredReset as getRegisteredReset,
  __resetRegistryForTests,
} from '@/App/Lib/resetAll.js';

beforeEach(() => {
  window.localStorage.clear();
  __resetRegistryForTests();
});

const stored = () =>
  JSON.parse(window.localStorage.getItem(LAYOUT_STORAGE_KEY));

describe('normalizeLayout', () => {
  it('returns defaults for a non-object', () => {
    expect(normalizeLayout(null)).toEqual(DEFAULTS);
    expect(normalizeLayout('nope')).toEqual(DEFAULTS);
    expect(normalizeLayout(undefined)).toEqual(DEFAULTS);
  });

  it.each([
    ['previewMode', 'sideways'],
    ['pageSize', 'a9'],
    ['orientation', 'diagonal'],
    ['marginPreset', 'enormous'],
  ])('rejects an invalid %s', (key, value) => {
    expect(normalizeLayout({ [key]: value })[key]).toBe(DEFAULTS[key]);
  });

  it.each([
    ['customWidth', 5],
    ['customWidth', 99999],
    ['customHeight', -10],
    ['marginTop', 500],
    ['marginLeft', -1],
  ])('clamps out-of-range %s=%s to the default', (key, value) => {
    expect(normalizeLayout({ [key]: value })[key]).toBe(DEFAULTS[key]);
  });

  it('accepts in-range numbers', () => {
    expect(normalizeLayout({ customWidth: 120 }).customWidth).toBe(120);
    expect(normalizeLayout({ marginTop: 0 }).marginTop).toBe(0);
    expect(normalizeLayout({ marginTop: 100 }).marginTop).toBe(100);
  });

  it('rejects non-string header and footer templates', () => {
    expect(normalizeLayout({ headerLeft: 42 }).headerLeft).toBe('');
    expect(normalizeLayout({ footerCenter: null }).footerCenter).toBe(
      DEFAULTS.footerCenter,
    );
  });

  it('keeps valid fields when a sibling is invalid', () => {
    const out = normalizeLayout({ pageSize: 'letter', orientation: 'nope' });
    expect(out.pageSize).toBe('letter');
    expect(out.orientation).toBe(DEFAULTS.orientation);
  });

  describe('nested groups', () => {
    it('deep-merges cover so a partial payload keeps the rest', () => {
      const out = normalizeLayout({ cover: { enabled: true } });
      expect(out.cover).toEqual({ ...DEFAULTS.cover, enabled: true });
    });

    it('deep-merges watermark and clamps opacity', () => {
      expect(normalizeLayout({ watermark: { opacity: 5 } }).watermark).toEqual(
        DEFAULTS.watermark,
      );
      expect(
        normalizeLayout({ watermark: { text: 'X', opacity: 0.5 } }).watermark,
      ).toEqual({ text: 'X', opacity: 0.5, showInPreview: false });
    });

    it('rejects an out-of-range toc depth', () => {
      expect(normalizeLayout({ toc: { depth: 9 } }).toc.depth).toBe(2);
      expect(normalizeLayout({ toc: { depth: 3 } }).toc.depth).toBe(3);
    });

    it('replaces a non-object group with its defaults', () => {
      expect(normalizeLayout({ cover: 'nope' }).cover).toEqual(DEFAULTS.cover);
      expect(normalizeLayout({ toc: 7 }).toc).toEqual(DEFAULTS.toc);
    });
  });
});

describe('resolveMargins', () => {
  it.each([
    ['small', 15],
    ['normal', 25],
    ['wide', 35],
  ])('%s resolves to %smm on every side', (preset, mm) => {
    expect(resolveMargins(normalizeLayout({ marginPreset: preset }))).toEqual({
      top: mm,
      right: mm,
      bottom: mm,
      left: mm,
    });
  });

  it('uses the per-side values for custom', () => {
    const layout = normalizeLayout({
      marginPreset: 'custom',
      marginTop: 5,
      marginRight: 10,
      marginBottom: 15,
      marginLeft: 20,
    });
    expect(resolveMargins(layout)).toEqual({
      top: 5,
      right: 10,
      bottom: 15,
      left: 20,
    });
  });

  it('exposes the preset table', () => {
    expect(MARGIN_PRESETS).toEqual({ small: 15, normal: 25, wide: 35 });
  });
});

describe('resolvePageSize', () => {
  it.each([
    ['a4', 210, 297],
    ['a3', 297, 420],
    ['a5', 148, 210],
    ['letter', 216, 279],
    ['legal', 216, 356],
  ])('%s is %sx%smm', (pageSize, width, height) => {
    expect(resolvePageSize(normalizeLayout({ pageSize }))).toEqual({
      width,
      height,
    });
  });

  it('uses the custom dimensions for custom', () => {
    expect(
      resolvePageSize(
        normalizeLayout({
          pageSize: 'custom',
          customWidth: 100,
          customHeight: 150,
        }),
      ),
    ).toEqual({ width: 100, height: 150 });
  });
});

describe('loadLayout', () => {
  it('returns defaults when the key is missing', () => {
    expect(loadLayout()).toEqual(DEFAULTS);
  });

  it('returns defaults for malformed JSON and repairs the value', () => {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, '{broken');
    expect(loadLayout()).toEqual(DEFAULTS);
    expect(stored()).toEqual(DEFAULTS);
  });

  it('fills in fields absent from an older payload', () => {
    // Schema growth within v1, as with mathCopyEnabled in Phase 4.
    window.localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({ pageSize: 'letter', orientation: 'landscape' }),
    );
    const out = loadLayout();
    expect(out.pageSize).toBe('letter');
    expect(out.orientation).toBe('landscape');
    expect(out.cover).toEqual(DEFAULTS.cover);
    expect(out.toc).toEqual(DEFAULTS.toc);
  });
});

describe('useLayout', () => {
  it('starts from defaults', () => {
    const { result } = renderHook(() => useLayout());
    expect(result.current[0]).toEqual(DEFAULTS);
  });

  it('rehydrates from localStorage on mount', () => {
    window.localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({ ...DEFAULTS, previewMode: 'paged', pageSize: 'a5' }),
    );
    const { result } = renderHook(() => useLayout());
    expect(result.current[0].previewMode).toBe('paged');
    expect(result.current[0].pageSize).toBe('a5');
  });

  it.each([
    ['setPreviewMode', 'paged', 'previewMode'],
    ['setPageSize', 'legal', 'pageSize'],
    ['setOrientation', 'landscape', 'orientation'],
    ['setMarginPreset', 'wide', 'marginPreset'],
    ['setHeaderCenter', 'Draft', 'headerCenter'],
    ['setFooterRight', '{date}', 'footerRight'],
    ['setCustomWidth', 150, 'customWidth'],
  ])('%s updates and persists', (updater, value, key) => {
    const { result } = renderHook(() => useLayout());
    act(() => result.current[1][updater](value));
    expect(result.current[0][key]).toBe(value);
    expect(stored()[key]).toBe(value);
  });

  it('setCover merges rather than replacing', () => {
    const { result } = renderHook(() => useLayout());
    act(() => result.current[1].setCover({ enabled: true }));
    act(() => result.current[1].setCover({ author: 'Me' }));
    expect(result.current[0].cover).toEqual({
      ...DEFAULTS.cover,
      enabled: true,
      author: 'Me',
    });
  });

  it('setWatermark merges rather than replacing', () => {
    const { result } = renderHook(() => useLayout());
    act(() => result.current[1].setWatermark({ text: 'DRAFT' }));
    act(() => result.current[1].setWatermark({ opacity: 0.3 }));
    expect(result.current[0].watermark).toEqual({
      text: 'DRAFT',
      opacity: 0.3,
      showInPreview: false,
    });
  });

  it('setToc merges rather than replacing', () => {
    const { result } = renderHook(() => useLayout());
    act(() => result.current[1].setToc({ enabled: true }));
    act(() => result.current[1].setToc({ depth: 3 }));
    expect(result.current[0].toc).toEqual({ enabled: true, depth: 3 });
  });

  it('rejects invalid values through the updaters', () => {
    const { result } = renderHook(() => useLayout());
    act(() => result.current[1].setPageSize('a9'));
    expect(result.current[0].pageSize).toBe(DEFAULTS.pageSize);
  });

  it('reset returns everything to defaults', () => {
    const { result } = renderHook(() => useLayout());
    act(() => {
      result.current[1].setPreviewMode('paged');
      result.current[1].setPageSize('a3');
      result.current[1].setCover({ enabled: true, title: 'X' });
    });
    act(() => result.current[1].reset());
    expect(result.current[0]).toEqual(DEFAULTS);
    expect(stored()).toEqual(DEFAULTS);
  });

  it('writes its own storage key', () => {
    const { result } = renderHook(() => useLayout());
    act(() => result.current[1].setPageSize('a5'));
    expect(Object.keys(window.localStorage)).toEqual([LAYOUT_STORAGE_KEY]);
    expect(LAYOUT_STORAGE_KEY).toBe('waynepdf.layout.v1');
  });

  it('keeps updater identities stable across renders', () => {
    const { result, rerender } = renderHook(() => useLayout());
    const first = result.current[1];
    rerender();
    expect(result.current[1]).toBe(first);
  });

  it('registers its reset with the central registry on mount', () => {
    const { unmount } = renderHook(() => useLayout());
    expect(__registeredResetNames()).toContain('layout');
    unmount();
    expect(__registeredResetNames()).not.toContain('layout');
  });

  it('registers the reset that actually resets', () => {
    const { result } = renderHook(() => useLayout());
    act(() => result.current[1].setPageSize('a5'));
    act(() => getRegisteredReset('layout')());
    expect(result.current[0]).toEqual(DEFAULTS);
  });
});
