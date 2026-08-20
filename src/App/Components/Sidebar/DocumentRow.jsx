import { useEffect, useRef, useState } from 'react';

/**
 * One document in the list.
 *
 * The title is not truncated in JS the way the tab label was: a fixed-width row
 * can ellipsis in CSS, which keeps the full title in the DOM for search, for the
 * tooltip, and for a screen reader.
 */
export default function DocumentRow({
  document: doc,
  isActive,
  isDragging,
  isDropTarget,
  renaming,
  onActivate,
  onClose,
  onContextMenu,
  onMouseDown,
  onRename,
  onRenameCancel,
}) {
  const [draft, setDraft] = useState(doc.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!renaming) return;
    setDraft(doc.title);
    // Select the whole title: renaming almost always means replacing.
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [renaming, doc.title]);

  const commit = () => onRename(draft);

  const classes = [
    'wp-doc-row',
    isActive && 'is-active',
    isDragging && 'is-dragging',
    isDropTarget && 'is-drop-target',
  ]
    .filter(Boolean)
    .join(' ');

  if (renaming) {
    return (
      <div className={classes} data-drag-id={doc.id} data-doc-id={doc.id}>
        <input
          ref={inputRef}
          className="wp-doc-rename"
          aria-label="Rename document"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          // Blur commits, matching how a file name behaves everywhere else.
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') onRenameCancel();
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={classes}
      data-drag-id={doc.id}
      data-doc-id={doc.id}
      onMouseDown={(event) => onMouseDown(event, doc.id)}
      onContextMenu={onContextMenu}
    >
      <button
        type="button"
        className="wp-doc-label"
        aria-current={isActive ? 'page' : undefined}
        title={doc.title}
        onClick={onActivate}
      >
        {doc.title}
      </button>
      <button
        type="button"
        /* no-drag: a mousedown here must delete the document, not start a
           reorder. */
        className="wp-doc-close no-drag"
        aria-label={`Close ${doc.title}`}
        onClick={onClose}
      >
        &times;
      </button>
    </div>
  );
}
