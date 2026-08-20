import { deriveTitle } from './paginatorPreprocess.js';

/*
 * PDF export — the Phase 5 Transform flow, moved out of the Header unchanged.
 *
 * Extracted in 6d.1 so all three formats dispatch through one place. The
 * behaviour is deliberately identical: 6.5 spent a whole phase stabilising this
 * pipeline and 6d does not re-enter it.
 */

/** afterprint is unreliable, so the timeout is the real guarantee. */
const CLEANUP_TIMEOUT_MS = 5000;

export async function exportPDF({ body, layout }) {
  const previewEl = document.querySelector('.preview');
  const isPaged = layout?.previewMode === 'paged';
  let printTarget = null;

  try {
    if (!isPaged) {
      const { md } = await import('../Components/Previewer/Preview.jsx');
      const { paginateInto } =
        await import('../Components/Previewer/Paginator.jsx');
      // From the text container, not by scraping CodeMirror's DOM: the container
      // is the source of truth the preview renders from, so the printed output
      // cannot drift from what the user is looking at.
      const html = md.render(body ?? '');

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
     * before the user has dismissed the dialog in some flows. The timeout is the
     * real guarantee; the listener just makes the common case tidy.
     */
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      document.body.classList.remove('wp-printing');
      printTarget?.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, CLEANUP_TIMEOUT_MS);
  }
}
