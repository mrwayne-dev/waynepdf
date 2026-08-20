import { useState } from 'react';
import { useDocumentsApi } from '../../Container';
import SidebarHeader from './SidebarHeader.jsx';
import NewDocumentButton from './NewDocumentButton.jsx';
import UploadButton from '../Upload.jsx';
import SearchInput from './SearchInput.jsx';
import DocumentList from './DocumentList.jsx';
import SidebarFooter from './SidebarFooter.jsx';
import './styles.css';

/**
 * The always-visible left rail.
 *
 * Replaces the horizontal tab strip, which could not grow: tabs shrink as you
 * add them, and past about six the titles stop being readable. A vertical list
 * grows by scrolling instead, which is why every app that expects more than a
 * handful of documents ends up here.
 *
 * Not collapsible and not resizable in v1. Both are easy to add and neither was
 * asked for; a fixed rail is one fewer piece of state to persist and reset.
 */
export default function Sidebar() {
  const { create, open, ready } = useDocumentsApi();
  const [query, setQuery] = useState('');

  const onNew = () => {
    const id = create();
    // Unlike `create` alone, the button implies "and take me there".
    if (id) open(id);
  };

  return (
    <aside className="wp-sidebar no-print" aria-label="Documents">
      <SidebarHeader />
      <NewDocumentButton onClick={onNew} />
      <UploadButton className="wp-sidebar-open" />
      <SearchInput value={query} onChange={setQuery} />
      {/* Before the first load resolves there is nothing truthful to draw, and
          an empty list that then pops full is worse than a beat of nothing. */}
      {ready ? <DocumentList query={query} /> : <div className="wp-doc-list" />}
      <SidebarFooter />
    </aside>
  );
}
