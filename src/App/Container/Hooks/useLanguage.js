import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { detectLanguage, RTL_LANGS } from '../../Lib/detectLanguage.js';
import useOverrides from './useOverrides.js';

/*
 * Document language and text direction.
 *
 * Two layers: what the detector thinks, and what the user said. The user
 * always wins, but detection keeps running so the Settings panel can show
 * "Detected: Japanese" beside the Auto option even when Auto is not selected.
 */

export const LANGUAGE_STORAGE_KEY = 'waynepdf.language.v1';

export const LANG_OPTIONS = [
  'auto',
  'en',
  'zh-Hant',
  'zh-Hans',
  'ja',
  'ko',
  'ar',
  'he',
  'ru',
  'und',
];

export const DIRECTIONS = ['auto', 'ltr', 'rtl'];

export const DEFAULT_LANG_SETTINGS = { lang: 'auto', direction: 'auto' };

/** Re-running detection on every keystroke would be wasted work. */
const DETECT_DEBOUNCE_MS = 500;

export function normalizeLanguageSettings(input) {
  const raw = input && typeof input === 'object' ? input : {};
  return {
    lang: LANG_OPTIONS.includes(raw.lang)
      ? raw.lang
      : DEFAULT_LANG_SETTINGS.lang,
    direction: DIRECTIONS.includes(raw.direction)
      ? raw.direction
      : DEFAULT_LANG_SETTINGS.direction,
  };
}

export function loadLanguageSettings() {
  let stored;
  try {
    stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return { ...DEFAULT_LANG_SETTINGS };
  }
  if (stored == null) return { ...DEFAULT_LANG_SETTINGS };
  try {
    return normalizeLanguageSettings(JSON.parse(stored));
  } catch {
    saveLanguageSettings(DEFAULT_LANG_SETTINGS);
    return { ...DEFAULT_LANG_SETTINGS };
  }
}

export function saveLanguageSettings(settings) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* best effort, same as theme settings */
  }
}

/** `auto` direction follows the language; only ar/he are RTL here. */
export const directionForLang = (lang) => (RTL_LANGS.has(lang) ? 'rtl' : 'ltr');

/**
 * nonaction builds containers by calling the hook with no arguments, and a
 * container hook cannot `useProvided` a sibling container — they all run in the
 * Provider component, above the context they populate. So the document text is
 * pushed in rather than read: whoever owns the text calls `observeText`.
 */
const useLanguage = () => {
  const [settings, setSettings] = useState(loadLanguageSettings);
  const overrides = useOverrides();
  const [detected, setDetected] = useState(() => ({
    lang: 'und',
    confidence: 0,
    breakdown: {},
  }));

  useEffect(() => {
    saveLanguageSettings(settings);
  }, [settings]);

  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const updaters = useMemo(
    () => ({
      setLang: (lang) =>
        setSettings((prev) => normalizeLanguageSettings({ ...prev, lang })),
      setDirection: (direction) =>
        setSettings((prev) =>
          normalizeLanguageSettings({ ...prev, direction }),
        ),
      reset: () => setSettings({ ...DEFAULT_LANG_SETTINGS }),
    }),
    [],
  );

  /** Debounced: typing must not re-scan the document on every keystroke. */
  const observeText = useCallback((text) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setDetected(detectLanguage(text)),
      DETECT_DEBOUNCE_MS,
    );
  }, []);

  /**
   * Synchronous path for file loads, where the whole document arrives at once
   * and waiting out a debounce would show one beat of the wrong font stack.
   */
  const detectNow = useCallback((text) => {
    clearTimeout(timer.current);
    setDetected(detectLanguage(text));
  }, []);

  const actions = useMemo(
    () => ({ ...updaters, observeText, detectNow }),
    [updaters, observeText, detectNow],
  );

  /*
   * Precedence: frontmatter, then the user's explicit choice, then detection.
   * The override is not written back to `settings`, so it never persists and
   * removing the block restores the user's own value.
   */
  const effectiveLang = overrides.lang ?? settings.lang;
  const effectiveDirection = overrides.direction ?? settings.direction;

  const resolvedLang = effectiveLang === 'auto' ? detected.lang : effectiveLang;
  const resolvedDirection =
    effectiveDirection === 'auto'
      ? directionForLang(resolvedLang)
      : effectiveDirection;

  return [
    {
      ...settings,
      lang: effectiveLang,
      direction: effectiveDirection,
      detectedLang: detected.lang,
      detectedConfidence: detected.confidence,
      breakdown: detected.breakdown,
      resolvedLang,
      resolvedDirection,
    },
    actions,
  ];
};

export default useLanguage;
