import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { registerReset, unregisterReset } from '../../Lib/resetAll.js';

/**
 * Which preferences section is showing, and whether the window is up at all.
 *
 * Deliberately not persisted. Where a user left the rail is not a preference,
 * it is the tail end of a task they already finished; restoring it a week later
 * would reopen a window on Layout because they once changed a margin. Theme,
 * fonts and layout persist — this does not.
 */

export const SECTIONS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'editor', label: 'Editor' },
  { id: 'document', label: 'Document' },
  { id: 'layout', label: 'Layout' },
  { id: 'themes', label: 'Themes' },
  { id: 'about', label: 'About' },
];

export const DEFAULT_SECTION = 'appearance';

const isSection = (id) => SECTIONS.some((s) => s.id === id);

const usePreferences = () => {
  const [state, setState] = useState({
    open: false,
    activeSection: DEFAULT_SECTION,
    searchQuery: '',
  });

  /*
   * Where focus was when the window opened, so closing can put it back.
   *
   * Held in a ref rather than state: it is written from inside the open()
   * handler and read on close, and making it state would re-render the whole
   * workspace for a value nothing renders.
   */
  const opener = useRef(null);

  const open = useCallback(() => {
    setState((prev) => {
      if (prev.open) return prev;
      opener.current =
        typeof document !== 'undefined' ? document.activeElement : null;
      return { ...prev, open: true };
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => {
      if (!prev.open) {
        opener.current =
          typeof document !== 'undefined' ? document.activeElement : null;
      }
      return { ...prev, open: !prev.open };
    });
  }, []);

  const setSection = useCallback((name) => {
    // An unknown id would render an empty content pane with a rail that shows
    // nothing selected, which looks like a broken window rather than a no-op.
    if (!isSection(name)) return;
    setState((prev) => ({ ...prev, activeSection: name }));
  }, []);

  const setSearch = useCallback((query) => {
    setState((prev) => ({ ...prev, searchQuery: String(query ?? '') }));
  }, []);

  /** Returns focus to whatever opened the window. */
  const restoreFocus = useCallback(() => {
    const element = opener.current;
    opener.current = null;
    if (element && typeof element.focus === 'function' && element.isConnected) {
      element.focus();
      return true;
    }
    return false;
  }, []);

  const api = useMemo(
    () => ({ open, close, toggle, setSection, setSearch, restoreFocus }),
    [open, close, toggle, setSection, setSearch, restoreFocus],
  );

  /*
   * Reset returns the rail and the search box to their defaults but leaves the
   * window open if it is open — Reset is triggered from inside this very
   * window's footer, and yanking it shut mid-reset would hide the confirmation
   * the user is looking at. The reload that follows closes it anyway.
   */
  useEffect(() => {
    const reset = () =>
      setState((prev) => ({
        ...prev,
        activeSection: DEFAULT_SECTION,
        searchQuery: '',
      }));
    registerReset('preferences', reset);
    return () => unregisterReset('preferences');
  }, []);

  return [state, api];
};

export default usePreferences;
