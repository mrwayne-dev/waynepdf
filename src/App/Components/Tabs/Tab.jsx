import { useEffect, useRef, useState } from 'react';

/** Long titles are truncated rather than allowed to widen the strip. */
const MAX_TITLE = 20;

const truncate = (title) =>
  title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1)}…` : title;

export default function Tab({
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
    // Select the whole title: renaming a tab almost always means replacing it.
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [renaming, doc.title]);

  const commit = () => onRename(draft);

  const classes = [
    'wp-tab',
    isActive && 'is-active',
    isDragging && 'is-dragging',
    isDropTarget && 'is-drop-target',
  ]
    .filter(Boolean)
    .join(' ');

  if (renaming) {
    return (
      <div className={classes} data-tab-id={doc.id}>
        <input
          ref={inputRef}
          className="wp-tab-rename"
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
      data-tab-id={doc.id}
      onMouseDown={(event) => onMouseDown(event, doc.id)}
      onContextMenu={onContextMenu}
    >
      <button
        type="button"
        className="wp-tab-label"
        aria-current={isActive ? 'page' : undefined}
        title={doc.title}
        onClick={onActivate}
      >
        {truncate(doc.title)}
      </button>
      <button
        type="button"
        /* no-drag: a mousedown here must close the tab, not start a reorder. */
        className="wp-tab-close no-drag"
        aria-label={`Close ${doc.title}`}
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}
