import { useDocumentsApi } from '../Container';
import './emptyWorkspace.css';

/**
 * What the workspace shows when there are no documents at all.
 *
 * Only reachable after a Reset — 6b.1's migration creates a default document on
 * first run, so a genuinely fresh browser never lands here. It still needs a
 * design: the alternative is an editor bound to nothing and a preview of
 * nothing, which reads as a broken app rather than an empty one.
 */
export default function EmptyWorkspace() {
  const { create, open } = useDocumentsApi();

  const onNew = () => {
    const id = create();
    if (id) open(id);
  };

  return (
    <div className="wp-empty-workspace">
      <p className="wp-empty-workspace-text">
        Create a new document to get started
      </p>
      <button type="button" className="wp-empty-workspace-button" onClick={onNew}>
        <span aria-hidden="true">+</span> New Document
      </button>
    </div>
  );
}
