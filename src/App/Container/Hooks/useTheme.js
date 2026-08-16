import { useState, useEffect, useMemo } from 'react';
import {
  DEFAULTS,
  THEMES,
  FONT_FAMILIES,
  RANGES,
  loadSettings,
  saveSettings,
  normalizeSettings,
} from '../../Lib/settings.js';
import { applyTheme, resolveTheme } from '../../Lib/applyTheme.js';

export { DEFAULTS, THEMES, FONT_FAMILIES, RANGES };

/**
 * Theme + typography state, mirrored to localStorage and to the DOM.
 *
 * Initial state is read synchronously in the useState initialiser rather than
 * in an effect: an effect would paint one frame of the default theme first,
 * which reads as a flash of the wrong colours on every reload.
 */
const useTheme = () => {
  const [settings, setSettings] = useState(loadSettings);

  // Persist + apply together. Both are idempotent, so running this on every
  // settings change (including the first) keeps a single code path.
  useEffect(() => {
    saveSettings(settings);
    applyTheme(settings);
  }, [settings]);

  // Only while 'system' is selected: follow the OS between light and dark.
  useEffect(() => {
    if (settings.theme !== 'system') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(settings);

    // Safari <14 only has the deprecated addListener.
    if (query.addEventListener) {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, [settings]);

  const updaters = useMemo(() => {
    const patch = (key) => (value) =>
      setSettings((prev) => normalizeSettings({ ...prev, [key]: value }));
    return {
      setTheme: patch('theme'),
      setFontFamily: patch('fontFamily'),
      setFontSize: patch('fontSize'),
      setLineHeight: patch('lineHeight'),
      setCodeFontSize: patch('codeFontSize'),
      setMathCopyEnabled: patch('mathCopyEnabled'),
      reset: () => setSettings({ ...DEFAULTS }),
    };
  }, []);

  // The concrete theme in effect, which is what the editor and the swatch ring
  // need — 'system' is never a real palette.
  const resolved = resolveTheme(settings.theme);

  return [{ ...settings, resolvedTheme: resolved }, updaters];
};

export default useTheme;
