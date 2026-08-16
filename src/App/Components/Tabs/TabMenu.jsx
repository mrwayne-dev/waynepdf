import { useEffect, useRef } from 'react';

/*
 * Right-click menu. Rename and Duplicate only.
 *
 * No Delete: the close button already deletes, and offering both would imply
 * they differ. Nothing in this phase provides a way back to a closed-but-kept
 * document, so pretending closing is reversible would be the worse lie.
 */
export default function TabMenu({ x, y, onRename, onDuplicate, onDismiss }) {
  const ref = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) onDismiss();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onDismiss();
    };
    // Capture phase: a tab underneath would otherwise activate on the same
    // click that dismisses the menu.
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onDismiss]);

  return (
    <div
      ref={ref}
      className="wp-tab-menu"
      role="menu"
      style={{ left: x, top: y }}
    >
      <button type="button" role="menuitem" onClick={onRename}>
        Rename
      </button>
      <button type="button" role="menuitem" onClick={onDuplicate}>
        Duplicate
      </button>
    </div>
  );
}
