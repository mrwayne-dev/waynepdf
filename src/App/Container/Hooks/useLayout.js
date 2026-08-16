import { useState, useEffect, useMemo } from 'react';
import useOverrides from './useOverrides.js';

/*
 * Page layout settings — everything that shapes the printed artefact rather
 * than the screen.
 *
 * Separate from theme settings (waynepdf.settings.v1) and language settings
 * (waynepdf.language.v1) because it is a much larger, nested schema with a
 * different lifecycle: theme changes repaint, layout changes re-paginate.
 */

export const LAYOUT_STORAGE_KEY = 'waynepdf.layout.v1';

export const PREVIEW_MODES = ['flowing', 'paged'];
export const PAGE_SIZES = ['a4', 'letter', 'legal', 'a5', 'a3', 'custom'];
export const ORIENTATIONS = ['portrait', 'landscape'];
export const MARGIN_PRESETS = { small: 15, normal: 25, wide: 35 };
export const MARGIN_PRESET_NAMES = ['small', 'normal', 'wide', 'custom'];
export const TOC_DEPTHS = [1, 2, 3];

/** mm. Used for custom-size validation and for the CSS `size:` shorthand. */
export const PAGE_DIMENSIONS = {
  a3: { width: 297, height: 420 },
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  letter: { width: 216, height: 279 },
  legal: { width: 216, height: 356 },
};

export const DEFAULTS = {
  previewMode: 'flowing',
  pageSize: 'a4',
  customWidth: 210,
  customHeight: 297,
  orientation: 'portrait',
  marginPreset: 'normal',
  marginTop: 25,
  marginRight: 25,
  marginBottom: 25,
  marginLeft: 25,
  headerLeft: '',
  headerCenter: '',
  headerRight: '{title}',
  footerLeft: '',
  footerCenter: '{page} / {pages}',
  footerRight: '',
  cover: { enabled: false, title: '', subtitle: '', author: '', date: '' },
  watermark: { text: '', opacity: 0.08, showInPreview: false },
  toc: { enabled: false, depth: 2 },
};

/** Generous but finite: a page smaller than a postage stamp is a mistake. */
const DIMENSION_RANGE = { min: 20, max: 2000 };
const MARGIN_RANGE = { min: 0, max: 100 };

const num = (value, { min, max }, fallback) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max
    ? value
    : fallback;

const str = (value, fallback) => (typeof value === 'string' ? value : fallback);
const bool = (value, fallback) =>
  typeof value === 'boolean' ? value : fallback;
const oneOf = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

/**
 * Coerces arbitrary input into a valid layout.
 *
 * Per-field, and deep for the three nested objects: a payload written before a
 * field existed keeps everything it does have and gains the default for the
 * rest. That is what lets the schema grow without a v2 key.
 */
export function normalizeLayout(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const cover = raw.cover && typeof raw.cover === 'object' ? raw.cover : {};
  const watermark =
    raw.watermark && typeof raw.watermark === 'object' ? raw.watermark : {};
  const toc = raw.toc && typeof raw.toc === 'object' ? raw.toc : {};

  return {
    previewMode: oneOf(raw.previewMode, PREVIEW_MODES, DEFAULTS.previewMode),
    pageSize: oneOf(raw.pageSize, PAGE_SIZES, DEFAULTS.pageSize),
    customWidth: num(raw.customWidth, DIMENSION_RANGE, DEFAULTS.customWidth),
    customHeight: num(raw.customHeight, DIMENSION_RANGE, DEFAULTS.customHeight),
    orientation: oneOf(raw.orientation, ORIENTATIONS, DEFAULTS.orientation),
    marginPreset: oneOf(
      raw.marginPreset,
      MARGIN_PRESET_NAMES,
      DEFAULTS.marginPreset,
    ),
    marginTop: num(raw.marginTop, MARGIN_RANGE, DEFAULTS.marginTop),
    marginRight: num(raw.marginRight, MARGIN_RANGE, DEFAULTS.marginRight),
    marginBottom: num(raw.marginBottom, MARGIN_RANGE, DEFAULTS.marginBottom),
    marginLeft: num(raw.marginLeft, MARGIN_RANGE, DEFAULTS.marginLeft),
    headerLeft: str(raw.headerLeft, DEFAULTS.headerLeft),
    headerCenter: str(raw.headerCenter, DEFAULTS.headerCenter),
    headerRight: str(raw.headerRight, DEFAULTS.headerRight),
    footerLeft: str(raw.footerLeft, DEFAULTS.footerLeft),
    footerCenter: str(raw.footerCenter, DEFAULTS.footerCenter),
    footerRight: str(raw.footerRight, DEFAULTS.footerRight),
    cover: {
      enabled: bool(cover.enabled, DEFAULTS.cover.enabled),
      title: str(cover.title, DEFAULTS.cover.title),
      subtitle: str(cover.subtitle, DEFAULTS.cover.subtitle),
      author: str(cover.author, DEFAULTS.cover.author),
      date: str(cover.date, DEFAULTS.cover.date),
    },
    watermark: {
      text: str(watermark.text, DEFAULTS.watermark.text),
      opacity: num(
        watermark.opacity,
        { min: 0, max: 1 },
        DEFAULTS.watermark.opacity,
      ),
      showInPreview: bool(
        watermark.showInPreview,
        DEFAULTS.watermark.showInPreview,
      ),
    },
    toc: {
      enabled: bool(toc.enabled, DEFAULTS.toc.enabled),
      depth: oneOf(toc.depth, TOC_DEPTHS, DEFAULTS.toc.depth),
    },
  };
}

/** Resolved margins in mm, collapsing the preset indirection. */
export function resolveMargins(layout) {
  if (layout.marginPreset === 'custom') {
    return {
      top: layout.marginTop,
      right: layout.marginRight,
      bottom: layout.marginBottom,
      left: layout.marginLeft,
    };
  }
  const v = MARGIN_PRESETS[layout.marginPreset] ?? MARGIN_PRESETS.normal;
  return { top: v, right: v, bottom: v, left: v };
}

/** Resolved page box in mm, before orientation is applied. */
export function resolvePageSize(layout) {
  if (layout.pageSize === 'custom') {
    return { width: layout.customWidth, height: layout.customHeight };
  }
  return PAGE_DIMENSIONS[layout.pageSize] ?? PAGE_DIMENSIONS.a4;
}

export function loadLayout() {
  let stored;
  try {
    stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
  } catch {
    return normalizeLayout(null);
  }
  if (stored == null) return normalizeLayout(null);
  try {
    return normalizeLayout(JSON.parse(stored));
  } catch {
    saveLayout(normalizeLayout(null));
    return normalizeLayout(null);
  }
}

export function saveLayout(layout) {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* best effort, same as theme and language settings */
  }
}

const useLayout = () => {
  // Synchronous init, as in useTheme: reading in an effect would paint one
  // frame of the default layout first.
  const [stored, setLayout] = useState(loadLayout);
  const overrides = useOverrides();

  /*
   * Frontmatter overrides merge over the stored layout for this document only.
   * The three nested groups merge rather than replace, so `toc: true` in a
   * document keeps the user's chosen depth.
   */
  const layout = useMemo(() => {
    const keys = Object.keys(overrides);
    if (keys.length === 0) return stored;
    const next = { ...stored };
    for (const key of [
      'pageSize',
      'orientation',
      'marginPreset',
      'marginTop',
      'marginRight',
      'marginBottom',
      'marginLeft',
    ]) {
      if (overrides[key] !== undefined) next[key] = overrides[key];
    }
    for (const group of ['toc', 'watermark', 'cover']) {
      if (overrides[group])
        next[group] = { ...stored[group], ...overrides[group] };
    }
    return normalizeLayout(next);
  }, [stored, overrides]);

  useEffect(() => {
    saveLayout(stored);
  }, [stored]);

  const updaters = useMemo(() => {
    const patch = (key) => (value) =>
      setLayout((prev) => normalizeLayout({ ...prev, [key]: value }));
    // Nested groups merge rather than replace, so a caller can set one field.
    const patchGroup = (group) => (partial) =>
      setLayout((prev) =>
        normalizeLayout({ ...prev, [group]: { ...prev[group], ...partial } }),
      );

    return {
      setPreviewMode: patch('previewMode'),
      setPageSize: patch('pageSize'),
      setCustomWidth: patch('customWidth'),
      setCustomHeight: patch('customHeight'),
      setOrientation: patch('orientation'),
      setMarginPreset: patch('marginPreset'),
      setMarginTop: patch('marginTop'),
      setMarginRight: patch('marginRight'),
      setMarginBottom: patch('marginBottom'),
      setMarginLeft: patch('marginLeft'),
      setHeaderLeft: patch('headerLeft'),
      setHeaderCenter: patch('headerCenter'),
      setHeaderRight: patch('headerRight'),
      setFooterLeft: patch('footerLeft'),
      setFooterCenter: patch('footerCenter'),
      setFooterRight: patch('footerRight'),
      setCover: patchGroup('cover'),
      setWatermark: patchGroup('watermark'),
      setToc: patchGroup('toc'),
      reset: () => setLayout(normalizeLayout(null)),
    };
  }, []);

  return [layout, updaters];
};

export default useLayout;
