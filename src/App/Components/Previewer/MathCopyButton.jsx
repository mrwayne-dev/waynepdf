import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useProvided } from 'nonaction';
import { ThemeContainer } from '../../Container';
import { toast } from '../Toast.jsx';

/**
 * Hover-revealed "copy LaTeX" affordance for rendered equations.
 *
 * Event delegation on the preview container rather than a button per equation:
 * a document can hold hundreds of equations, and rendering hundreds of
 * always-mounted buttons would cost more than the feature is worth. One button
 * moves.
 *
 * The button is positioned rather than nested inside .katex because KaTeX's
 * layout is a tower of inline-block spans with computed heights — injecting a
 * child would disturb its metrics.
 */

/** Grace period so the cursor can travel from equation to button. */
const LEAVE_DELAY_MS = 200;

/** Matches the rendered height of .math-copy-button in math.css. */
const BUTTON_HEIGHT_PX = 20;

const PORTAL_ID = 'math-copy-portal';

export default function MathCopyButton() {
  const [settings] = useProvided(ThemeContainer);
  const enabled = settings.mathCopyEnabled !== false;

  const [target, setTarget] = useState(null);
  const [rect, setRect] = useState(null);
  const leaveTimer = useRef(null);
  const portalRef = useRef(null);

  /*
   * One portal host for the app's lifetime, mounted inside #waynepdf-app rather
   * than on <body>. The app's print rule that hides .no-print is scoped to its
   * own subtree, so a host on <body> would escape it and the button could reach
   * the PDF. Positioning is unaffected — the button is position: fixed and no
   * ancestor establishes a containing block.
   */
  if (!portalRef.current && typeof document !== 'undefined') {
    let host = document.getElementById(PORTAL_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = PORTAL_ID;
      host.className = 'no-print';
      (document.getElementById('waynepdf-app') ?? document.body).appendChild(
        host,
      );
    }
    portalRef.current = host;
  }

  const clear = useCallback(() => {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => {
      setTarget(null);
      setRect(null);
    }, LEAVE_DELAY_MS);
  }, []);

  const hold = useCallback(() => clearTimeout(leaveTimer.current), []);

  useEffect(() => {
    if (!enabled) {
      setTarget(null);
      setRect(null);
      return;
    }

    const onOver = (event) => {
      const katex = event.target.closest?.('.katex[data-latex]');
      if (!katex) return;
      // Only inside the preview: the editor pane never contains rendered math.
      if (!katex.closest('.preview')) return;
      clearTimeout(leaveTimer.current);
      setTarget(katex);
      setRect(katex.getBoundingClientRect());
    };

    const onOut = (event) => {
      if (!event.target.closest?.('.katex[data-latex]')) return;
      clear();
    };

    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('mouseout', onOut, true);
    // A scroll moves the equation out from under the button; drop it rather
    // than tracking, which would mean a rAF loop for a hover affordance.
    const onScroll = () => {
      setTarget(null);
      setRect(null);
    };
    window.addEventListener('scroll', onScroll, true);

    return () => {
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('mouseout', onOut, true);
      window.removeEventListener('scroll', onScroll, true);
      clearTimeout(leaveTimer.current);
    };
  }, [enabled, clear]);

  const onCopy = async () => {
    const latex = target?.getAttribute('data-latex');
    if (!latex) return;
    try {
      await navigator.clipboard.writeText(latex);
      toast('LaTeX copied');
    } catch {
      // Permission denied or no secure context. Say so rather than appearing
      // to have worked.
      toast('Could not copy to clipboard');
    }
  };

  if (!enabled || !target || !rect || !portalRef.current) return null;

  return createPortal(
    <button
      type="button"
      className="math-copy-button no-print"
      style={{
        // Fixed positioning against the viewport rect, so no assumptions about
        // which ancestor happens to be a containing block.
        position: 'fixed',
        /*
         * Sits just ABOVE the equation's top-right corner, not on it. Anchored
         * inside the box it covers the very thing you are trying to read —
         * short inline equations end up almost entirely hidden behind it.
         * Clamped so it cannot escape the top of the viewport.
         */
        top: `${Math.max(2, rect.top - BUTTON_HEIGHT_PX)}px`,
        left: `${rect.right}px`,
        transform: 'translateX(-100%)',
      }}
      onMouseEnter={hold}
      onMouseLeave={clear}
      onClick={onCopy}
      aria-label="Copy LaTeX source"
      title="Copy LaTeX"
    >
      Copy
    </button>,
    portalRef.current,
  );
}
