import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDocumentsApi } from '../../Container';
import DocumentRow from './DocumentRow.jsx';
import DocumentContextMenu from './DocumentContextMenu.jsx';
import useDragReorder from './useDragReorder.js';

const matches = (query, title) =>
  String(title ?? '')
    .toLowerCase()
    .includes(query.trim().toLowerCase());

/**
 * The scrolling list of documents.
 *
 * Search filters what is rendered rather than hiding rows with CSS, because the
 * order is what drag-reorder works on: dragging row 3 past a hidden row 2 would
 * otherwise reorder something the user cannot see. Reordering is therefore
 * disabled while a filter is active, which is the honest behaviour — there is no
 * meaningful "move to position 2" in a filtered view.
 */
export default function DocumentList({ query }) {
  const {
    documents,
    activeId,
    open,
    remove,
    rename,
    duplicate,
    reorder,
  } = useDocumentsApi();

  const [menu, setMenu] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const listRef = useRef(null);

  const filtering = query.trim().length > 0;
  const visible = useMemo(
    () => (filtering ? documents.filter((d) => matches(query, d.title)) : documents),
    [documents, query, filtering],
  );

  const ids = useMemo(() => documents.map((doc) => doc.id), [documents]);
  const onReorder = useCallback((order) => reorder(order), [reorder]);
  const { draggingId, dropIndex, onMouseDown, consumeClickSuppression } =
    useDragReorder({
      ids,
      onReorder,
      containerRef: listRef,
      axis: 'y',
    });

  const closeMenu = useCallback(() => setMenu(null), []);
  const noop = useCallback(() => {}, []);

  /*
   * Keep the active row on screen.
   *
   * The tab strip never needed this — six tabs always fit. A list of
   * twenty-five does not, so clicking "+ New Document" at the top of a long
   * list created a document, activated it, and left the user looking at rows
   * belonging to something else. `nearest` so switching to a row already in
   * view does not jolt the list.
   */
  useEffect(() => {
    if (!activeId) return;
    listRef.current
      ?.querySelector(`[data-doc-id="${activeId}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  if (documents.length === 0) {
    return (
      <div className="wp-doc-list" ref={listRef}>
        <p className="wp-sidebar-empty">
          No documents yet. Click New Document to start.
        </p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="wp-doc-list" ref={listRef}>
        <p className="wp-sidebar-empty">No documents match “{query}”.</p>
      </div>
    );
  }

  return (
    <div className="wp-doc-list" ref={listRef}>
      {visible.map((doc, index) => (
        <DocumentRow
          key={doc.id}
          document={doc}
          isActive={doc.id === activeId}
          isDragging={doc.id === draggingId}
          isDropTarget={draggingId !== null && dropIndex === index}
          renaming={renamingId === doc.id}
          onMouseDown={filtering ? noop : onMouseDown}
          onActivate={() => {
            // A completed drag ends in a click on the same element.
            if (consumeClickSuppression()) return;
            open(doc.id);
          }}
          onClose={() => {
            if (renamingId === doc.id) setRenamingId(null);
            remove(doc.id);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenu({ id: doc.id, x: event.clientX, y: event.clientY });
          }}
          onRename={(title) => {
            rename(doc.id, title);
            setRenamingId(null);
          }}
          onRenameCancel={() => setRenamingId(null)}
        />
      ))}

      {menu && (
        <DocumentContextMenu
          x={menu.x}
          y={menu.y}
          onDismiss={closeMenu}
          onRename={() => {
            setRenamingId(menu.id);
            closeMenu();
          }}
          onDuplicate={() => {
            duplicate(menu.id);
            closeMenu();
          }}
        />
      )}
    </div>
  );
}
