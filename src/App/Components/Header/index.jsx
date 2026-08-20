import styled from 'styled-components';
import { useProvided } from 'nonaction';
import UploadButton from '../Upload.jsx';
import ExportButton from './ExportButton.jsx';
import { LayoutContainer, useDocumentsApi } from '../../Container';

/**
 * Autosave state, in words.
 *
 * "Unsaved changes" is reserved for a save that actually failed — a blocked or
 * full IndexedDB. During normal typing the work is either pending or written,
 * and calling that "unsaved" would train users to ignore the one message that
 * means something.
 */
const SAVE_LABELS = {
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Unsaved changes',
};

const MODES = [
  { id: 'flowing', label: 'Flowing' },
  { id: 'paged', label: 'Paged' },
];

const Header = ({ className, pageCount }) => {
  const [layout, { setPreviewMode }] = useProvided(LayoutContainer);
  const { status, ready } = useDocumentsApi();

  return (
    <header className={className + ' no-print'}>
      <div className="modes" role="group" aria-label="Preview mode">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`mode${layout.previewMode === mode.id ? ' is-active' : ''}`}
            aria-pressed={layout.previewMode === mode.id}
            onClick={() => setPreviewMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {layout.previewMode === 'paged' && pageCount > 0 && (
        <p className="page-count" aria-live="polite">
          {pageCount} {pageCount === 1 ? 'page' : 'pages'}
        </p>
      )}

      {ready && (
        <p
          className={`save-status is-${status}`}
          data-save-status={status}
          aria-live="polite"
        >
          {SAVE_LABELS[status] ?? SAVE_LABELS.saved}
        </p>
      )}

      <div className="menu">
        <UploadButton className="button upload" />
        <ExportButton />
      </div>
    </header>
  );
};

export default styled(Header)`
  * {
    box-sizing: border-box;
  }
  flex-shrink: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  user-select: none;
  display: flex;
  align-items: center;
  /* Fixed height, so the horizontal padding is the only padding — vertical
     padding on a fixed-height flex row just fights the height. */
  height: 52px;
  padding: 0 var(--wp-space-4);
  gap: var(--wp-space-3);
  /* Theme tokens, not literals: the header sits outside .markdown-body, so
     without these it stays light grey in Dark and Sepia. */
  color: var(--wp-color-fg);
  background-color: var(--wp-color-canvas);
  border-bottom: 1px solid var(--wp-color-border);
  font-family: var(--wp-font-family-ui);
  font-size: var(--wp-text-base);

  div.modes {
    display: flex;
    flex-shrink: 0;
    .mode {
      font-family: inherit;
      font-size: var(--wp-text-sm);
      height: var(--wp-h-control-sm);
      padding: 0 var(--wp-space-3);
      color: var(--wp-color-fg);
      background-color: var(--wp-color-canvas);
      border: 1px solid var(--wp-color-border);
      cursor: pointer;
      transition: background-color var(--wp-ui-transition);
    }
    /* Connected pill: only the outer edges are rounded. */
    .mode:first-child {
      border-radius: var(--wp-radius) 0 0 var(--wp-radius);
    }
    .mode:last-child {
      border-radius: 0 var(--wp-radius) var(--wp-radius) 0;
      border-left: 0;
    }
    .mode:hover {
      background-color: var(--wp-color-canvas-subtle);
    }
    .mode.is-active {
      color: var(--wp-color-canvas);
      background-color: var(--wp-color-accent);
      border-color: var(--wp-color-accent);
    }
    .mode:focus-visible {
      outline: 2px solid var(--wp-color-accent);
      outline-offset: 1px;
    }
  }

  p.page-count {
    flex-shrink: 0;
    margin: 0;
    font-size: var(--wp-text-sm);
    color: var(--wp-color-fg-muted);
    font-variant-numeric: tabular-nums;
  }

  p.save-status {
    flex-shrink: 0;
    margin: 0;
    font-size: var(--wp-text-sm);
    color: var(--wp-color-fg-muted);
    /* Fixed width: "Saved" and "Saving…" alternate constantly while typing, and
       a reflowing header is far more distracting than the word itself. */
    min-width: 9ch;
  }
  p.save-status.is-error {
    color: var(--wp-color-danger);
    font-weight: 500;
  }

  .wp-gear {
    /* Lived in the settings stylesheet until 7.0 stripped that panel's chrome;
       it belongs to the header now, and leaves with it in 7.2. */
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--wp-h-control);
    height: var(--wp-h-control);
    padding: 0;
    color: var(--wp-color-fg-muted);
    background-color: transparent;
    border: 0;
    border-radius: var(--wp-radius);
    cursor: pointer;
    transition:
      background-color var(--wp-ui-transition),
      color var(--wp-ui-transition);
  }
  .wp-gear:hover {
    color: var(--wp-color-fg);
    background-color: var(--wp-color-canvas-subtle);
  }
  .wp-gear:focus-visible {
    outline: 2px solid var(--wp-color-accent);
    outline-offset: 1px;
  }

  div.menu {
    /* Takes the slack so the buttons sit hard right; the gap on the header
       handles the spacing between everything else. */
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--wp-space-2);
    .button {
      display: flex;
      align-items: center;
      margin: 0;
      height: var(--wp-h-control);
      padding: 0 var(--wp-space-4);
      font-size: var(--wp-text-sm);
      font-weight: 500;
      border-radius: var(--wp-radius);
      border: 1px solid var(--wp-color-border);
      background-color: var(--wp-color-canvas);
      cursor: pointer;
      transition:
        background-color var(--wp-ui-transition),
        border-color var(--wp-ui-transition);
    }
    .button:hover {
      background-color: var(--wp-color-canvas-subtle);
    }
    .button:focus-visible {
      outline: 2px solid var(--wp-color-accent);
      outline-offset: 1px;
    }
  }
`;
