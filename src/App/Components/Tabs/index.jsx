import { useCallback, useMemo, useRef, useState } from 'react';
import { useDocumentsApi } from '../../Container';
import Tab from './Tab.jsx';
import TabMenu from './TabMenu.jsx';
import NewTabButton from './NewTabButton.jsx';
import useDragReorder from './useDragReorder.js';
import './styles.css';

/**
 * The document tab strip.
 *
 * Sits above the editor rather than spanning the window: tabs switch what is
 * being *edited*, and putting them over the preview too would suggest they
 * switch something about the output.
 */
export default function TabStrip() {
  const {
    documents,
    activeId,
    ready,
    create,
    open,
    remove,
    rename,
    duplicate,
    reorder,
  } = useDocumentsApi();

  const [menu, setMenu] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const listRef = useRef(null);

  const ids = useMemo(() => documents.map((doc) => doc.id), [documents]);

  const onReorder = useCallback((order) => reorder(order), [reorder]);
  const { draggingId, dropIndex, onMouseDown, consumeClickSuppression } =
    useDragReorder({ ids, onReorder, containerRef: listRef });

  const closeMenu = useCallback(() => setMenu(null), []);

  const onNewTab = () => {
    const id = create();
    // Unlike `create` on its own, the + button implies "and take me there".
    if (id) open(id);
  };

  // Before the first load resolves there is nothing truthful to draw, and an
  // empty strip that then pops full is worse than a beat of nothing.
  if (!ready) return null;

  return (
    <div className="wp-tabs no-print">
      <div className="wp-tabs-list" ref={listRef}>
        {documents.map((doc, index) => (
          <Tab
            key={doc.id}
            document={doc}
            isActive={doc.id === activeId}
            isDragging={doc.id === draggingId}
            isDropTarget={draggingId !== null && dropIndex === index}
            renaming={renamingId === doc.id}
            onMouseDown={onMouseDown}
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
        <NewTabButton onClick={onNewTab} />
      </div>

      {menu && (
        <TabMenu
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
