import { useEffect, useRef } from 'react';

/*
 * Right-click menu. Rename and Duplicate only.
 *
 * No Delete: the row's × already deletes, and offering both would imply they
 * differ. Nothing here provides a way back to a deleted document, so pretending
 * otherwise would be the worse lie.
 */
export default function DocumentContextMenu({
  x,
  y,
  onRename,
  onDuplicate,
  onDismiss,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) onDismiss();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onDismiss();
    };
    // Capture phase: a row underneath would otherwise activate on the same
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
      className="wp-doc-menu"
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
