import { TopBar, Markdown } from './index.js';
import EmptyWorkspace from './EmptyWorkspace.jsx';
import { useDocumentsApi } from '../Container';

/**
 * The document half of the shell: top bar over the editor/preview split.
 *
 * Swaps to an empty state when there are no documents, rather than rendering a
 * top bar for a document that does not exist above an editor bound to nothing.
 * `ready` gates it so the beat before IndexedDB resolves does not flash the
 * empty state at someone who has twenty documents.
 */
export default function Workspace() {
  const { documents, ready } = useDocumentsApi();
  const empty = ready && documents.length === 0;

  return (
    <div className="wp-workspace">
      {empty ? (
        <EmptyWorkspace />
      ) : (
        <>
          <TopBar />
          <Markdown />
        </>
      )}
    </div>
  );
}
