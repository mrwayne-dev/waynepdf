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
import { registerReset, unregisterReset } from '../../Lib/resetAll.js';
import useOverrides from './useOverrides.js';

export { DEFAULTS, THEMES, FONT_FAMILIES, RANGES };

/**
 * Theme + typography state, mirrored to localStorage and to the DOM.
 *
 * Initial state is read synchronously in the useState initialiser rather than
 * in an effect: an effect would paint one frame of the default theme first,
 * which reads as a flash of the wrong colours on every reload.
 */
const useTheme = () => {
  const [stored, setSettings] = useState(loadSettings);
  const overrides = useOverrides();

  /*
   * Frontmatter wins over the user's own choice, for this document only. The
   * merged value is what everything downstream sees; `stored` is what gets
   * persisted, so an override never leaks into localStorage.
   */
  const settings = useMemo(
    () =>
      overrides.theme && overrides.theme !== stored.theme
        ? normalizeSettings({ ...stored, theme: overrides.theme })
        : stored,
    [stored, overrides.theme],
  );

  // Persist + apply together. Both are idempotent, so running this on every
  // settings change (including the first) keeps a single code path.
  useEffect(() => {
    saveSettings(stored);
  }, [stored]);

  useEffect(() => {
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
      setEditorFontSize: patch('editorFontSize'),
      setMathCopyEnabled: patch('mathCopyEnabled'),
      setSanitizeHtml: patch('sanitizeHtml'),
      reset: () => setSettings({ ...DEFAULTS }),
    };
  }, []);

  // Reset is centralised; this container only has to say how to reset itself.
  useEffect(() => {
    registerReset('theme', updaters.reset);
    return () => unregisterReset('theme');
  }, [updaters]);

  // The concrete theme in effect, which is what the editor and the swatch ring
  // need — 'system' is never a real palette.
  const resolved = resolveTheme(settings.theme);

  return [{ ...settings, resolvedTheme: resolved }, updaters];
};

export default useTheme;
