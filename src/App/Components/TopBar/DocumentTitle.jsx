import { useEffect, useRef, useState } from 'react';
import { useDocumentsApi } from '../../Container';

/**
 * The active document's title, editable in place.
 *
 * Same commit/cancel contract as the sidebar row's rename — Enter or blur
 * saves, Esc reverts — because they rename the same thing and a user who
 * learned one should not have to learn the other.
 */
export default function DocumentTitle() {
  const { activeDocument, rename, ready } = useDocumentsApi();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  if (!ready || !activeDocument) return null;

  const start = () => {
    setDraft(activeDocument.title);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    // An empty title would leave the sidebar row blank and unfindable; treating
    // it as a cancel is kinder than storing it or popping an error.
    if (next && next !== activeDocument.title) rename(activeDocument.id, next);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="wp-title-input"
        aria-label="Rename document"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="wp-title"
      title={`${activeDocument.title} — click to rename`}
      onClick={start}
    >
      {activeDocument.title}
    </button>
  );
}
