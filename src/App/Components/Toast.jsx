import { useState, useEffect, useRef } from 'react';
import './Toast.css';

/**
 * Transient bottom-centre notice, driven by a custom DOM event.
 *
 * Event-driven rather than context-driven on purpose: the things that want to
 * toast are often deep in event handlers or outside React's tree entirely (the
 * math copy button is rendered through a portal). `dispatchEvent` reaches it
 * from anywhere with no plumbing, and keeps this reusable for later phases.
 *
 *   window.dispatchEvent(new CustomEvent('waynepdf:toast', { detail: { message } }))
 */

export const TOAST_EVENT = 'waynepdf:toast';
export const TOAST_DURATION_MS = 1500;

/** Convenience emitter so callers don't hand-build the event. */
export function toast(message) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message } }));
}

export default function Toast() {
  const [message, setMessage] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    const onToast = (event) => {
      const next = event.detail?.message;
      if (!next) return;
      clearTimeout(timer.current);
      setMessage(next);
      timer.current = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      clearTimeout(timer.current);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="wp-toast no-print" role="status" aria-live="polite">
      {message}
    </div>
  );
}
