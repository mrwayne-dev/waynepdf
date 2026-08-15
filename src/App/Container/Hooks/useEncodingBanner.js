import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

/**
 * The one-shot notice shown after a file load.
 *
 * Deliberately not an alert() and not a modal: a successful Big5 decode is
 * information, not an interruption. It auto-dismisses, and any edit to the
 * document clears it — by then the user has moved on.
 */

export const BANNER_TIMEOUT_MS = 8000;

const useEncodingBanner = () => {
  const [banner, setBanner] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const dismissBanner = useCallback(() => {
    clearTimeout(timer.current);
    setBanner(null);
  }, []);

  const showBanner = useCallback((next) => {
    clearTimeout(timer.current);
    if (!next) {
      setBanner(null);
      return;
    }
    setBanner(next);
    timer.current = setTimeout(() => setBanner(null), BANNER_TIMEOUT_MS);
  }, []);

  const actions = useMemo(
    () => ({ showBanner, dismissBanner }),
    [showBanner, dismissBanner],
  );

  return [banner, actions];
};

export default useEncodingBanner;
