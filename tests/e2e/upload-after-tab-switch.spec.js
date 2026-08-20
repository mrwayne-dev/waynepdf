import { test, expect } from '@playwright/test';
import { boot, setText } from './_helpers.js';

/*
 * Regression: dropping a file after switching tabs did nothing.
 *
 * The third bug traced to StrictMode's duplicate CodeMirror instance. Phase 0
 * picked "the last node" as the live one, which was true at first mount and
 * stopped being true once Phase 6b.2 keyed the editor on the active document —
 * a tab switch remounts it, and the survivor is not reliably last. Writing to
 * the wrong instance is silent, because react-codemirror2 drops change events
 * from unmounted components, so the file simply never loaded.
 */

const tabs = (page) => page.locator('.wp-doc-row');
const activeTab = (page) => page.locator('.wp-doc-row.is-active');

/**
 * Waits for a tab switch to finish rebuilding the editor.
 *
 * The signal has to be the *incoming* document's text: before the remount both
 * instances agree on the outgoing document, which looks settled and is exactly
 * the window this bug lived in.
 */
const settleEditorTo = (page, expected) =>
  page.waitForFunction(
    (want) => {
      const nodes = [...document.querySelectorAll('.CodeMirror')];
      return (
        nodes.length > 0 &&
        nodes.every((n) => n.CodeMirror?.getValue() === want)
      );
    },
    expected,
    { timeout: 15_000 },
  );

/** Drops a .md file onto the editor, the way a user does. */
const dropFile = (page, name, contents) =>
  page.evaluate(
    ([filename, body]) => {
      const dt = new DataTransfer();
      dt.items.add(new File([body], filename, { type: 'text/markdown' }));
      document.querySelector('.CodeMirror').dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: dt,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    [name, contents],
  );

/** Every connected CodeMirror instance's current text. */
const editorValues = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.CodeMirror')].map(
      (n) => n.CodeMirror?.getValue() ?? null,
    ),
  );

/*
 * The deterministic check.
 *
 * Asserting "the drop worked" is not enough: which of the two StrictMode
 * instances is live varies between runs, so the old single-node implementation
 * passed roughly half the time. What is invariant is that after a load, no
 * instance is left holding stale text — writing to one of two never satisfies
 * that, writing to all of them always does.
 */
test('a load leaves no CodeMirror instance holding stale text', async ({
  page,
}) => {
  await boot(page);
  await setText(page, '# First Tab\n\noriginal content');
  await expect(page.locator('.wp-autosave-dot')).toHaveText('Saved');

  await page.locator('.wp-sidebar-new').click();
  await settleEditorTo(page, '');
  await tabs(page).nth(0).locator('.wp-doc-label').click();
  await settleEditorTo(page, '# First Tab\n\noriginal content');

  const dropped = '# Dropped Doc\n\nfresh body';
  await dropFile(page, 'dropped.md', dropped);
  await expect(page.locator('.preview h1')).toHaveText('Dropped Doc', {
    timeout: 15_000,
  });

  const values = await editorValues(page);
  expect(values.length).toBeGreaterThan(0);
  for (const [i, value] of values.entries()) {
    expect(value, `CodeMirror instance ${i} of ${values.length}`).toBe(dropped);
  }
});

test('a dropped file loads after switching tabs', async ({ page }) => {
  await boot(page);
  await setText(page, '# First Tab\n\noriginal content');
  await expect(page.locator('.wp-autosave-dot')).toHaveText('Saved');

  // Second tab, with its own content — this is the remount that broke it.
  await page.locator('.wp-sidebar-new').click();
  await settleEditorTo(page, '');
  await setText(page, '# Second Tab\n\nsecond content');
  await expect(page.locator('.preview h1')).toHaveText('Second Tab');

  // Back to the first, which remounts the editor again.
  await tabs(page).nth(0).locator('.wp-doc-label').click();
  await settleEditorTo(page, '# First Tab\n\noriginal content');

  await dropFile(page, 'dropped.md', '# Dropped After Switch\n\nfrom a drop');

  await expect(page.locator('.preview h1')).toHaveText('Dropped After Switch', {
    timeout: 15_000,
  });
  await expect(page.locator('.preview')).toContainText('from a drop');
});

test('the drop lands in the active tab only, not in every tab', async ({
  page,
}) => {
  await boot(page);
  await setText(page, '# Tab One\n\nkeep me');
  await expect(page.locator('.wp-autosave-dot')).toHaveText('Saved');

  await page.locator('.wp-sidebar-new').click();
  await settleEditorTo(page, '');
  await setText(page, '# Tab Two\n\nalso keep me');
  await expect(page.locator('.wp-autosave-dot')).toHaveText('Saved');

  // Drop into tab two, which is active.
  await dropFile(page, 'dropped.md', '# Replaced Two\n\nnew body');
  await expect(page.locator('.preview h1')).toHaveText('Replaced Two', {
    timeout: 15_000,
  });

  /*
   * The fix writes to every CodeMirror instance, so this is the check that
   * matters: the value must still reach only ONE document. The dead instances
   * accept the text and emit nothing, so nothing crosses tabs.
   */
  await tabs(page).nth(0).locator('.wp-doc-label').click();
  await expect(page.locator('.preview h1')).toHaveText('Tab One');
  await expect(page.locator('.preview')).toContainText('keep me');
  await expect(page.locator('.preview')).not.toContainText('new body');
});

test('the file picker also works after a tab switch', async ({ page }) => {
  await boot(page);
  await setText(page, '# Picker Tab\n\nbefore');
  await expect(page.locator('.wp-autosave-dot')).toHaveText('Saved');

  await page.locator('.wp-sidebar-new').click();
  await settleEditorTo(page, '');
  await tabs(page).nth(0).locator('.wp-doc-label').click();
  await settleEditorTo(page, '# Picker Tab\n\nbefore');

  await page.setInputFiles('#mdFile', {
    name: 'picked.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Picked After Switch\n\nvia the picker'),
  });

  await expect(page.locator('.preview h1')).toHaveText('Picked After Switch', {
    timeout: 15_000,
  });
  await expect(activeTab(page).locator('.wp-doc-label')).toHaveText(
    'Picked After Switch',
  );
});
