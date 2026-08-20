import DocumentTitle from './DocumentTitle.jsx';
import AutosaveDot from './AutosaveDot.jsx';
import ModeToggle from './ModeToggle.jsx';
import ExportButton from './Export/ExportButton.jsx';
import './styles.css';

/**
 * The document's own bar.
 *
 * 44px, down from 52. Everything global left for the sidebar — the wordmark,
 * the preferences gear, the file picker — so what remains is scoped to the
 * document in front of you: what it is called, whether it is saved, how it is
 * being previewed, and how to get it out.
 *
 * The page count goes with them. It was a header ornament that only appeared in
 * Paged mode and is visible in the paginated preview itself, which is where
 * someone counting pages is already looking.
 */
export default function TopBar() {
  return (
    <header className="wp-topbar no-print">
      <div className="wp-topbar-left">
        <DocumentTitle />
        <AutosaveDot />
      </div>

      <div className="wp-topbar-right">
        <ModeToggle />
        <ExportButton />
      </div>
    </header>
  );
}
