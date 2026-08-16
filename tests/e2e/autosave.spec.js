import { test, expect } from '@playwright/test';
import { boot, setText } from './_helpers.js';

/**
 * Autosave, and the refresh-loses-work bug it exists to kill.
 *
 * Documents live in IndexedDB from Phase 6b.1 on. Every assertion here is about
 * work surviving something — a reload, a hidden tab, a close.
 */

const AUTOSAVE_MS = 1000;

/*
 * The editor's own text, not the preview's — proves the round trip.
 *
 * The *last* .CodeMirror node, because react-codemirror2 v8 leaves two connected
 * ones under StrictMode and only the last is wired to state. The same trap
 * upload.spec.js documents, and the reason uploadFile.js has its own workaround.
 */
const editorText = (page) =>
  page.evaluate(() => {
    const nodes = document.querySelectorAll('.CodeMirror');
    return nodes[nodes.length - 1]?.innerText ?? '';
  });

const saveStatus = (page) => page.locator('.save-status');

/** Reads the persisted documents straight out of IndexedDB. */
const storedDocuments = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('waynepdf');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db
            .transaction('documents')
            .objectStore('documents')
            .getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        };
      }),
  );

test('a document survives a reload', async ({ page }) => {
  await boot(page);
  await setText(page, '# Survives\n\nWritten before the reload.');
  await expect(saveStatus(page)).toHaveText('Saved');

  await page.reload();
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );

  await expect(page.locator('.preview h1')).toHaveText('Survives');
  expect(await editorText(page)).toContain('Written before the reload.');
});

test('the default document is created on a first visit and persisted', async ({
  page,
}) => {
  await boot(page);
  const docs = await storedDocuments(page);
  expect(docs).toHaveLength(1);
  expect(docs[0].body).toContain('WaynePDF');
  expect(docs[0].title).toBeTruthy();
});

test('the migration runs once, not again on every visit', async ({ page }) => {
  await boot(page);
  await setText(page, '# Only Me');
  await expect(saveStatus(page)).toHaveText('Saved');

  await page.reload();
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect(page.locator('.preview h1')).toHaveText('Only Me');

  const docs = await storedDocuments(page);
  expect(docs).toHaveLength(1);
});

test('the title is derived from the first h1', async ({ page }) => {
  await boot(page);
  await setText(page, '# Derived Title\n\nbody');
  await expect(saveStatus(page)).toHaveText('Saved');

  const docs = await storedDocuments(page);
  expect(docs[0].title).toBe('Derived Title');
});

test('the indicator goes Saving… then Saved on an edit', async ({ page }) => {
  await boot(page);
  await expect(saveStatus(page)).toHaveText('Saved');

  // No await between the edit and the assertion: "Saving…" is the state during
  // the debounce, so it is observable for the full second.
  await setText(page, '# Watch the indicator');
  await expect(saveStatus(page)).toHaveText('Saving…');
  await expect(saveStatus(page)).toHaveText('Saved', { timeout: 10_000 });
});

test('hiding the page flushes a pending edit without waiting out the debounce', async ({
  page,
}) => {
  await boot(page);
  await setText(page, '# Hidden Flush');
  await expect(saveStatus(page)).toHaveText('Saving…');

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect
    .poll(async () => (await storedDocuments(page))[0].body, {
      timeout: 10_000,
    })
    .toBe('# Hidden Flush');
});

test('reloading with unsaved changes raises no beforeunload prompt', async ({
  page,
}) => {
  await boot(page);

  const dialogs = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    dialog.dismiss();
  });

  // Edit and reload inside the debounce window, which is exactly when the old
  // nag used to fire.
  await setText(page, '# Unsaved and leaving');
  await page.reload();
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );

  expect(dialogs).toEqual([]);
});

/*
 * Deliberately NOT tested: that an edit made in the final second before a
 * reload survives it.
 *
 * IndexedDB writes are asynchronous and beforeunload cannot await one, so the
 * unload guard is a best-effort kick that Chromium honours only sometimes. The
 * real guarantees are the debounce and the visibilitychange flush above; a test
 * asserting the unload path would be asserting a coin flip. The exposure is up
 * to AUTOSAVE_MS of typing on an immediate close — noted as a known gap rather
 * than papered over with a retry.
 */

test('typing in the editor persists, not just programmatic setText', async ({
  page,
}) => {
  await boot(page);

  // Select-all then type, rather than clearing first: clicking into the editor
  // makes react-codemirror2 re-emit its own current value, which would undo a
  // programmatic clear.
  const editor = page.locator('.CodeMirror').last();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('# Typed By Hand');

  await expect(page.locator('.preview h1')).toHaveText('Typed By Hand');
  await expect(saveStatus(page)).toHaveText('Saved', { timeout: 10_000 });

  await page.reload();
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect(page.locator('.preview h1')).toHaveText('Typed By Hand');
});

test('the indicator is chrome and never reaches the PDF', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'page.pdf() is Chromium-only');
  await boot(page);
  await setText(page, '# Print Me');
  await expect(saveStatus(page)).toHaveText('Saved');

  const buffer = await page.pdf({ format: 'A4' });
  expect(buffer.toString('latin1')).not.toContain('Saved');
});

test('a rapid burst of edits collapses into one stored value', async ({
  page,
}) => {
  await boot(page);
  for (const n of [1, 2, 3, 4, 5]) {
    await setText(page, `# Burst ${n}`);
    await page.waitForTimeout(AUTOSAVE_MS / 5);
  }
  await expect(saveStatus(page)).toHaveText('Saved', { timeout: 10_000 });

  const docs = await storedDocuments(page);
  expect(docs).toHaveLength(1);
  expect(docs[0].body).toBe('# Burst 5');
});
