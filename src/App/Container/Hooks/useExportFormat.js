import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FORMAT_IDS,
  effectiveFormat,
  isFormatAvailable,
} from '../../Lib/exportRegistry.js';
import { registerReset, unregisterReset } from '../../Lib/resetAll.js';

/*
 * Which export format the split button acts on.
 *
 * Its own tiny key rather than a field on the layout or theme settings: it is a
 * property of the person, not of the document or of how the document looks, and
 * folding it into either would make it travel with a frontmatter override.
 */

export const EXPORT_FORMAT_KEY = 'waynepdf.exportFormat.v1';
export const DEFAULT_FORMAT = 'pdf';

export function normalizeFormat(value) {
  return FORMAT_IDS.includes(value) ? value : DEFAULT_FORMAT;
}

export function loadExportFormat() {
  try {
    return normalizeFormat(window.localStorage.getItem(EXPORT_FORMAT_KEY));
  } catch {
    return DEFAULT_FORMAT;
  }
}

export function saveExportFormat(format) {
  try {
    window.localStorage.setItem(EXPORT_FORMAT_KEY, format);
  } catch {
    /* best effort, same as every other settings key */
  }
}

const useExportFormat = () => {
  // Synchronous init, as everywhere else: reading in an effect would paint one
  // frame of the wrong button label.
  const [stored, setStored] = useState(loadExportFormat);

  const setFormat = useCallback((value) => {
    const next = normalizeFormat(value);
    setStored(next);
    saveExportFormat(next);
  }, []);

  const reset = useCallback(() => setStored(DEFAULT_FORMAT), []);

  useEffect(() => {
    registerReset('exportFormat', reset);
    return () => unregisterReset('exportFormat');
  }, [reset]);

  return useMemo(
    () => [
      {
        /*
         * `stored` is what the user picked; `format` is what the button does.
         * They differ only while a format is declared but not yet wired, and
         * keeping both means the preference survives until it can be honoured.
         */
        stored,
        format: effectiveFormat(stored),
        available: isFormatAvailable(stored),
      },
      { setFormat, reset },
    ],
    [stored, setFormat, reset],
  );
};

export default useExportFormat;
