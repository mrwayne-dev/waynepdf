import { useState } from 'react';
import styled from 'styled-components';
import { useProvided } from 'nonaction';
import UploadButton from '../Upload.jsx';
import Settings from '../Settings/index.jsx';
import {
  LayoutContainer,
  TextContainer,
  useDocumentsApi,
} from '../../Container';
import { deriveTitle } from '../../Lib/paginatorPreprocess.js';

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
  const [text] = useProvided(TextContainer);
  const { status, ready } = useDocumentsApi();
  const [printing, setPrinting] = useState(false);

  /*
   * Transform always prints paginated output, whichever mode the preview is in.
   *
   * In Paged mode the fragmented DOM is already on screen and print CSS just
   * strips the screen chrome. In Flowing mode there is nothing paginated yet,
   * so we build it into a hidden target first — the user gets real page breaks,
   * headers and page numbers without having to switch modes to get them.
   */
  const onTransform = async () => {
    if (printing) return;
    setPrinting(true);

    const previewEl = document.querySelector('.preview');
    const isPaged = layout.previewMode === 'paged';
    let printTarget = null;

    try {
      if (!isPaged) {
        const { md } = await import('../Previewer/Preview.jsx');
        const { paginateInto } = await import('../Previewer/Paginator.jsx');
        // From the text container, not by scraping CodeMirror's DOM: the
        // container is the source of truth the preview renders from, so the
        // printed output cannot drift from what the user is looking at.
        const html = md.render(text ?? '');

        printTarget = document.createElement('div');
        printTarget.id = 'wp-print-target';
        // Inside the app shell so the scoped print rules reach it.
        (document.getElementById('waynepdf-app') ?? document.body).appendChild(
          printTarget,
        );
        await paginateInto(html, layout, printTarget);
      }

      document.body.classList.add('wp-printing');

      // Chrome uses document.title as the default Save-as-PDF filename.
      const title = deriveTitle(layout, printTarget ?? previewEl);
      const originalTitle = document.title;
      document.title = title;

      // Let the browser lay out the freshly-mounted pages before it snapshots.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      window.print();
      document.title = originalTitle;
    } finally {
      /*
       * afterprint is unreliable — Safari never fires it, and Chrome fires it
       * before the user has dismissed the dialog in some flows. The timeout is
       * the real guarantee; the listener just makes the common case tidy.
       */
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        document.body.classList.remove('wp-printing');
        printTarget?.remove();
        window.removeEventListener('afterprint', cleanup);
        setPrinting(false);
      };
      window.addEventListener('afterprint', cleanup);
      setTimeout(cleanup, 5000);
    }
  };

  return (
    <header className={className + ' no-print'}>
      <p className="project"> WaynePDF </p>

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

      <Settings />

      <div className="menu">
        <UploadButton className="button upload" />
        <p className="button download" onClick={onTransform}>
          <span>{printing ? 'Preparing…' : 'Transform'}</span>
        </p>
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
  padding-left: 5px;
  padding-right: 5px;
  /* Theme tokens, not literals: the header sits outside .markdown-body, so
     without these it stays light grey in Dark and Sepia. */
  color: var(--wp-color-fg);
  background-color: var(--wp-color-canvas-subtle);
  border-bottom: 1px solid var(--wp-color-border);
  font-family: var(--wp-font-family-sans);
  font-size: var(--wp-ui-font-size);
  display: flex;
  align-items: center;
  height: 40px;
  .project {
    font-weight: bold;
    margin: 5px;
    flex-shrink: 0;
    height: 20px;
  }
  div.modes {
    display: flex;
    flex-shrink: 0;
    margin-left: 8px;
    .mode {
      font-family: inherit;
      font-size: inherit;
      color: var(--wp-color-fg);
      background-color: var(--wp-color-canvas);
      border: 1px solid var(--wp-color-border);
      padding: 4px 10px;
      cursor: pointer;
      transition: background-color var(--wp-ui-transition);
    }
    /* Connected pill: only the outer edges are rounded. */
    .mode:first-child {
      border-radius: var(--wp-ui-radius) 0 0 var(--wp-ui-radius);
    }
    .mode:last-child {
      border-radius: 0 var(--wp-ui-radius) var(--wp-ui-radius) 0;
      border-left: 0;
    }
    .mode:hover {
      background-color: var(--wp-color-neutral-muted);
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
    margin: 0 0 0 10px;
    color: var(--wp-color-fg-muted);
    font-variant-numeric: tabular-nums;
  }
  p.save-status {
    flex-shrink: 0;
    margin: 0 0 0 12px;
    color: var(--wp-color-fg-muted);
    /* Fixed width: "Saved" and "Saving…" alternate constantly while typing, and
       a reflowing header is far more distracting than the word itself. */
    min-width: 9ch;
  }
  p.save-status.is-error {
    color: var(--wp-color-danger);
    font-weight: 600;
  }
  div.menu {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    .button {
      height: 80%;
      margin: 0;
      display: flex;
      align-items: center;
      margin-left: 3px;
      border-radius: var(--wp-ui-radius);
      border: 1px solid var(--wp-color-border);
      background-color: var(--wp-color-canvas);
      padding: 10px;
      cursor: pointer;
      transition: background-color var(--wp-ui-transition);
    }
    .button:hover {
      background-color: var(--wp-color-neutral-muted);
    }
  }

  @keyframes dance {
    0% {
      transform: rotate(3deg);
    }
    100% {
      transform: rotate(-2deg);
    }
  }
`;
