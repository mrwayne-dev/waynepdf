import { test, expect } from '@playwright/test';
import { boot, setText } from './_helpers.js';

/**
 * Multi-document behaviour: create, switch, close, rename, duplicate, reorder.
 *
 * Written against the 6b.2 tab strip and repointed at 7.1's sidebar list. The
 * assertions are unchanged — what "close removes it from IndexedDB" means does
 * not depend on whether the row is horizontal — so this migrated rather than
 * being rewritten. The one real change is the drag axis.
 */

const list = (page) => page.locator('.wp-doc-list');
const rows = (page) => page.locator('.wp-doc-row');
const docLabels = (page) => page.locator('.wp-doc-row .wp-doc-label');
const activeRow = (page) => page.locator('.wp-doc-row.is-active');
const newDocument = (page) => page.locator('.wp-sidebar-new');
const saveStatus = (page) => page.locator('.wp-autosave-dot');

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

const reload = async (page) => {
  await page.reload();
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
};

/**
 * Waits for a tab switch to finish re-seeding the editor.
 *
 * Switching tabs remounts CodeMirror with the incoming document's body. Until
 * that lands there are two live instances holding different text, and a
 * programmatic setText in that window writes to one of them while the pending
 * remount then re-seeds the document from the other — silently blanking it.
 * (Pre-existing; see PHASE_6.5b_SUMMARY.md. Not this phase's to fix, but the
 * tests must not race it.)
 *
 * The signal has to be every instance holding the *incoming* document's text.
 * "All instances agree" is not enough: before the remount they agree on the
 * OUTGOING document, which reads as settled and is exactly the window the race
 * lives in.
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

/** Creates a tab and waits for the editor to show the new empty document. */
async function addDocument(page) {
  await newDocument(page).click();
  await settleEditorTo(page, '');
}

/** Drags a tab horizontally onto another tab's slot. */
async function dragRowOnto(page, fromIndex, toIndex) {
  const from = rows(page).nth(fromIndex);
  const to = rows(page).nth(toIndex);
  const a = await from.boundingBox();
  const b = await to.boundingBox();

  /*
   * Land a quarter into the target rather than dead centre. The drop slot is
   * chosen by which side of a row's midpoint the cursor is on, so aiming at the
   * midpoint itself aims at the decision boundary and lets sub-pixel rounding
   * of boundingBox() pick the answer — which made this flaky roughly one run in
   * four. A user dragging a row aims at the row, not at one pixel of it.
   *
   * Vertical since 7.1: the list runs down the sidebar, so the axis that
   * decides the drop is y.
   */
  const landing =
    toIndex < fromIndex ? b.y + b.height * 0.25 : b.y + b.height * 0.75;

  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  // Two moves: the first crosses the click/drag threshold, the second lands.
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 12, {
    steps: 4,
  });
  await page.mouse.move(b.x + b.width / 2, landing, { steps: 8 });
  await page.mouse.up();
}

test('a fresh visit shows exactly one tab', async ({ page }) => {
  await boot(page);
  await expect(rows(page)).toHaveCount(1);
  await expect(activeRow(page)).toHaveCount(1);
});

test('the + button creates a document and activates it', async ({ page }) => {
  await boot(page);
  await addDocument(page);

  await expect(rows(page)).toHaveCount(2);
  await expect(activeRow(page).locator('.wp-doc-label')).toHaveText('Untitled');
  await expect.poll(async () => (await storedDocuments(page)).length).toBe(2);
});

test('each tab keeps its own text', async ({ page }) => {
  await boot(page);
  await setText(page, '# One');
  await expect(saveStatus(page)).toHaveText('Saved');

  await addDocument(page);
  await setText(page, '# Two');
  await expect(page.locator('.preview h1')).toHaveText('Two');

  await rows(page).nth(0).locator('.wp-doc-label').click();
  await expect(page.locator('.preview h1')).toHaveText('One');

  await rows(page).nth(1).locator('.wp-doc-label').click();
  await expect(page.locator('.preview h1')).toHaveText('Two');
});

test('switching tabs force-saves the outgoing document', async ({ page }) => {
  await boot(page);
  await addDocument(page);

  // No wait for the debounce: only the flush on switch can save this.
  await setText(page, '# Not Yet Debounced');
  await rows(page).nth(0).locator('.wp-doc-label').click();
  await rows(page).nth(1).locator('.wp-doc-label').click();

  await expect(page.locator('.preview h1')).toHaveText('Not Yet Debounced');
});

test('the tab title tracks the first h1', async ({ page }) => {
  await boot(page);
  await setText(page, '# Tracked Title\n\nbody');
  await expect(activeRow(page).locator('.wp-doc-label')).toHaveText(
    'Tracked Title',
  );
});

test('a long title is truncated visually but kept in full', async ({ page }) => {
  /*
   * The tab strip truncated in JS at 20 characters and appended an ellipsis, so
   * the DOM only ever held the shortened string. The row lets CSS do it, which
   * means search, the tooltip and a screen reader all still see the whole title
   * — so this asserts the full text is present *and* that it overflows its box.
   */
  await boot(page);
  const long = 'A Very Long Document Title Indeed That Keeps Going';
  await setText(page, `# ${long}`);

  const label = activeRow(page).locator('.wp-doc-label');
  await expect(label).toHaveText(long);
  await expect(label).toHaveAttribute('title', long);

  const { overflows, ellipsis } = await label.evaluate((el) => ({
    overflows: el.scrollWidth > el.clientWidth,
    ellipsis: getComputedStyle(el).textOverflow,
  }));
  expect(overflows).toBe(true);
  expect(ellipsis).toBe('ellipsis');
});

test('closing a tab removes it from the strip and from IndexedDB', async ({
  page,
}) => {
  await boot(page);
  await addDocument(page);
  await setText(page, '# Doomed Tab');
  await expect(saveStatus(page)).toHaveText('Saved');
  await expect(rows(page)).toHaveCount(2);

  const doomed = rows(page).nth(1);
  await doomed.hover();
  await doomed.locator('.wp-doc-close').click();

  await expect(rows(page)).toHaveCount(1);
  await expect.poll(async () => (await storedDocuments(page)).length).toBe(1);
  const docs = await storedDocuments(page);
  expect(docs[0].body).not.toContain('Doomed Tab');
});

test('closing the active tab activates its right-hand neighbour', async ({
  page,
}) => {
  await boot(page);
  await addDocument(page);
  await setText(page, '# Middle');
  await addDocument(page);
  await setText(page, '# Right');

  await rows(page).nth(1).locator('.wp-doc-label').click();
  await expect(page.locator('.preview h1')).toHaveText('Middle');

  const middle = rows(page).nth(1);
  await middle.hover();
  await middle.locator('.wp-doc-close').click();

  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator('.preview h1')).toHaveText('Right');
});

test('closing the only tab leaves a fresh empty one', async ({ page }) => {
  await boot(page);
  const only = rows(page).first();
  await only.hover();
  await only.locator('.wp-doc-close').click();

  await expect(rows(page)).toHaveCount(1);
  await expect(activeRow(page).locator('.wp-doc-label')).toHaveText('Untitled');
  await expect(page.locator('.preview h1')).toHaveCount(0);
});

test('right-click offers Rename and Duplicate, and nothing else', async ({
  page,
}) => {
  await boot(page);
  await rows(page).first().click({ button: 'right' });

  const menu = page.locator('.wp-doc-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('button')).toHaveText(['Rename', 'Duplicate']);
});

test('the context menu dismisses on Escape and on a click outside', async ({
  page,
}) => {
  await boot(page);
  await rows(page).first().click({ button: 'right' });
  await expect(page.locator('.wp-doc-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.wp-doc-menu')).toHaveCount(0);

  await rows(page).first().click({ button: 'right' });
  await expect(page.locator('.wp-doc-menu')).toBeVisible();
  await page.locator('.preview').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.wp-doc-menu')).toHaveCount(0);
});

test('Rename edits inline, commits on Enter, and persists', async ({
  page,
}) => {
  await boot(page);
  await rows(page).first().click({ button: 'right' });
  await page.locator('.wp-doc-menu button', { hasText: 'Rename' }).click();

  const input = page.locator('.wp-doc-rename');
  await expect(input).toBeFocused();
  await input.fill('My Renamed Doc');
  await input.press('Enter');

  await expect(activeRow(page).locator('.wp-doc-label')).toHaveText(
    'My Renamed Doc',
  );

  await reload(page);
  await expect(activeRow(page).locator('.wp-doc-label')).toHaveText(
    'My Renamed Doc',
  );
});

test('Escape cancels a rename', async ({ page }) => {
  await boot(page);
  const before = await rows(page).first().locator('.wp-doc-label').innerText();

  await rows(page).first().click({ button: 'right' });
  await page.locator('.wp-doc-menu button', { hasText: 'Rename' }).click();
  await page.locator('.wp-doc-rename').fill('Discarded');
  await page.locator('.wp-doc-rename').press('Escape');

  await expect(rows(page).first().locator('.wp-doc-label')).toHaveText(before);
});

test('Duplicate copies the body and sits next to the original', async ({
  page,
}) => {
  await boot(page);
  await setText(page, '# Original Doc\n\nshared body');
  await expect(saveStatus(page)).toHaveText('Saved');
  await addDocument(page);

  await rows(page).nth(0).click({ button: 'right' });
  await page.locator('.wp-doc-menu button', { hasText: 'Duplicate' }).click();

  await expect(docLabels(page)).toHaveText([
    'Original Doc',
    'Original Doc (copy)',
    'Untitled',
  ]);

  await rows(page).nth(1).locator('.wp-doc-label').click();
  await expect(page.locator('.preview')).toContainText('shared body');
});

test('dragging a tab reorders it, and the order survives a reload', async ({
  page,
}) => {
  await boot(page);
  await setText(page, '# Alpha');
  await addDocument(page);
  await setText(page, '# Beta');
  await addDocument(page);
  await setText(page, '# Gamma');
  await expect(saveStatus(page)).toHaveText('Saved');
  await expect(docLabels(page)).toHaveText(['Alpha', 'Beta', 'Gamma']);

  await dragRowOnto(page, 2, 0);
  await expect(docLabels(page)).toHaveText(['Gamma', 'Alpha', 'Beta']);

  await reload(page);
  await expect(docLabels(page)).toHaveText(['Gamma', 'Alpha', 'Beta']);
});

test('a click on a tab still activates it after a drag has happened', async ({
  page,
}) => {
  await boot(page);
  await setText(page, '# Alpha');
  await addDocument(page);
  await setText(page, '# Beta');

  await dragRowOnto(page, 1, 0);
  await expect(docLabels(page)).toHaveText(['Beta', 'Alpha']);

  // The drag ends in a click on the dragged tab; that click must be swallowed,
  // but the next real one must not be.
  await rows(page).nth(1).locator('.wp-doc-label').click();
  await expect(page.locator('.preview h1')).toHaveText('Alpha');
});

test('tabs and the active document survive a reload', async ({ page }) => {
  await boot(page);
  await setText(page, '# First');
  await addDocument(page);
  await setText(page, '# Second');
  await addDocument(page);
  await setText(page, '# Third');
  await rows(page).nth(1).locator('.wp-doc-label').click();
  await expect(page.locator('.preview h1')).toHaveText('Second');
  await expect(saveStatus(page)).toHaveText('Saved');

  await reload(page);

  await expect(docLabels(page)).toHaveText(['First', 'Second', 'Third']);
  await expect(activeRow(page).locator('.wp-doc-label')).toHaveText('Second');
  await expect(page.locator('.preview h1')).toHaveText('Second');
});

test('a long list scrolls rather than shrinking the rows', async ({ page }) => {
  /*
   * The point of the sidebar. Tabs shrank as you added them and stopped being
   * readable past about six; rows keep their height and the list scrolls.
   */
  await boot(page);
  for (let i = 0; i < 24; i += 1) await addDocument(page);
  await expect(rows(page)).toHaveCount(25);

  // Every row is still full height — nothing was squeezed to make them fit.
  const heights = await rows(page).evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().height)),
  );
  expect(new Set(heights)).toEqual(new Set([36]));

  const { scrollHeight, clientHeight } = await list(page).evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(scrollHeight).toBeGreaterThan(clientHeight);

  // Scrolling must reach the last row rather than clipping it away.
  await list(page).evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(rows(page).last()).toBeInViewport();
});

test('the strip is chrome and never reaches the PDF', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'page.pdf() is Chromium-only');
  await boot(page);
  await rows(page).first().click({ button: 'right' });
  await setText(page, '# Printed');

  const buffer = await page.pdf({ format: 'A4' });
  const text = buffer.toString('latin1');
  expect(text).not.toContain('Duplicate');
  expect(text).not.toContain('Untitled');
});
