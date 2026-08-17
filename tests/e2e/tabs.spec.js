import { test, expect } from '@playwright/test';
import { boot, setText } from './_helpers.js';

/** Multi-document tab strip: create, switch, close, rename, duplicate, reorder. */

const strip = (page) => page.locator('.wp-tabs-list');
const tabs = (page) => page.locator('.wp-tab');
const tabLabels = (page) => page.locator('.wp-tab .wp-tab-label');
const activeTab = (page) => page.locator('.wp-tab.is-active');
const newTab = (page) => page.locator('.wp-tab-new');
const saveStatus = (page) => page.locator('.save-status');

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
async function addTab(page) {
  await newTab(page).click();
  await settleEditorTo(page, '');
}

/** Drags a tab horizontally onto another tab's slot. */
async function dragTabOnto(page, fromIndex, toIndex) {
  const from = tabs(page).nth(fromIndex);
  const to = tabs(page).nth(toIndex);
  const a = await from.boundingBox();
  const b = await to.boundingBox();

  /*
   * Land a quarter into the target rather than dead centre. The drop slot is
   * chosen by which side of a tab's midpoint the cursor is on, so aiming at the
   * midpoint itself aims at the decision boundary and lets sub-pixel rounding
   * of boundingBox() pick the answer — which made this flaky roughly one run in
   * four. A user dragging a tab aims at the tab, not at one pixel of it.
   */
  const landing =
    toIndex < fromIndex ? b.x + b.width * 0.25 : b.x + b.width * 0.75;

  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  // Two moves: the first crosses the click/drag threshold, the second lands.
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2, {
    steps: 4,
  });
  await page.mouse.move(landing, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('a fresh visit shows exactly one tab', async ({ page }) => {
  await boot(page);
  await expect(tabs(page)).toHaveCount(1);
  await expect(activeTab(page)).toHaveCount(1);
});

test('the + button creates a document and activates it', async ({ page }) => {
  await boot(page);
  await addTab(page);

  await expect(tabs(page)).toHaveCount(2);
  await expect(activeTab(page).locator('.wp-tab-label')).toHaveText('Untitled');
  await expect.poll(async () => (await storedDocuments(page)).length).toBe(2);
});

test('each tab keeps its own text', async ({ page }) => {
  await boot(page);
  await setText(page, '# One');
  await expect(saveStatus(page)).toHaveText('Saved');

  await addTab(page);
  await setText(page, '# Two');
  await expect(page.locator('.preview h1')).toHaveText('Two');

  await tabs(page).nth(0).locator('.wp-tab-label').click();
  await expect(page.locator('.preview h1')).toHaveText('One');

  await tabs(page).nth(1).locator('.wp-tab-label').click();
  await expect(page.locator('.preview h1')).toHaveText('Two');
});

test('switching tabs force-saves the outgoing document', async ({ page }) => {
  await boot(page);
  await addTab(page);

  // No wait for the debounce: only the flush on switch can save this.
  await setText(page, '# Not Yet Debounced');
  await tabs(page).nth(0).locator('.wp-tab-label').click();
  await tabs(page).nth(1).locator('.wp-tab-label').click();

  await expect(page.locator('.preview h1')).toHaveText('Not Yet Debounced');
});

test('the tab title tracks the first h1', async ({ page }) => {
  await boot(page);
  await setText(page, '# Tracked Title\n\nbody');
  await expect(activeTab(page).locator('.wp-tab-label')).toHaveText(
    'Tracked Title',
  );
});

test('a long title is truncated in the strip but kept in full', async ({
  page,
}) => {
  await boot(page);
  const long = 'A Very Long Document Title Indeed';
  await setText(page, `# ${long}`);

  const label = activeTab(page).locator('.wp-tab-label');
  await expect(label).toHaveText(/…$/);
  await expect(label).toHaveAttribute('title', long);
});

test('closing a tab removes it from the strip and from IndexedDB', async ({
  page,
}) => {
  await boot(page);
  await addTab(page);
  await setText(page, '# Doomed Tab');
  await expect(saveStatus(page)).toHaveText('Saved');
  await expect(tabs(page)).toHaveCount(2);

  const doomed = tabs(page).nth(1);
  await doomed.hover();
  await doomed.locator('.wp-tab-close').click();

  await expect(tabs(page)).toHaveCount(1);
  await expect.poll(async () => (await storedDocuments(page)).length).toBe(1);
  const docs = await storedDocuments(page);
  expect(docs[0].body).not.toContain('Doomed Tab');
});

test('closing the active tab activates its right-hand neighbour', async ({
  page,
}) => {
  await boot(page);
  await addTab(page);
  await setText(page, '# Middle');
  await addTab(page);
  await setText(page, '# Right');

  await tabs(page).nth(1).locator('.wp-tab-label').click();
  await expect(page.locator('.preview h1')).toHaveText('Middle');

  const middle = tabs(page).nth(1);
  await middle.hover();
  await middle.locator('.wp-tab-close').click();

  await expect(tabs(page)).toHaveCount(2);
  await expect(page.locator('.preview h1')).toHaveText('Right');
});

test('closing the only tab leaves a fresh empty one', async ({ page }) => {
  await boot(page);
  const only = tabs(page).first();
  await only.hover();
  await only.locator('.wp-tab-close').click();

  await expect(tabs(page)).toHaveCount(1);
  await expect(activeTab(page).locator('.wp-tab-label')).toHaveText('Untitled');
  await expect(page.locator('.preview h1')).toHaveCount(0);
});

test('right-click offers Rename and Duplicate, and nothing else', async ({
  page,
}) => {
  await boot(page);
  await tabs(page).first().click({ button: 'right' });

  const menu = page.locator('.wp-tab-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('button')).toHaveText(['Rename', 'Duplicate']);
});

test('the context menu dismisses on Escape and on a click outside', async ({
  page,
}) => {
  await boot(page);
  await tabs(page).first().click({ button: 'right' });
  await expect(page.locator('.wp-tab-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.wp-tab-menu')).toHaveCount(0);

  await tabs(page).first().click({ button: 'right' });
  await expect(page.locator('.wp-tab-menu')).toBeVisible();
  await page.locator('.preview').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.wp-tab-menu')).toHaveCount(0);
});

test('Rename edits inline, commits on Enter, and persists', async ({
  page,
}) => {
  await boot(page);
  await tabs(page).first().click({ button: 'right' });
  await page.locator('.wp-tab-menu button', { hasText: 'Rename' }).click();

  const input = page.locator('.wp-tab-rename');
  await expect(input).toBeFocused();
  await input.fill('My Renamed Doc');
  await input.press('Enter');

  await expect(activeTab(page).locator('.wp-tab-label')).toHaveText(
    'My Renamed Doc',
  );

  await reload(page);
  await expect(activeTab(page).locator('.wp-tab-label')).toHaveText(
    'My Renamed Doc',
  );
});

test('Escape cancels a rename', async ({ page }) => {
  await boot(page);
  const before = await tabs(page).first().locator('.wp-tab-label').innerText();

  await tabs(page).first().click({ button: 'right' });
  await page.locator('.wp-tab-menu button', { hasText: 'Rename' }).click();
  await page.locator('.wp-tab-rename').fill('Discarded');
  await page.locator('.wp-tab-rename').press('Escape');

  await expect(tabs(page).first().locator('.wp-tab-label')).toHaveText(before);
});

test('Duplicate copies the body and sits next to the original', async ({
  page,
}) => {
  await boot(page);
  await setText(page, '# Original Doc\n\nshared body');
  await expect(saveStatus(page)).toHaveText('Saved');
  await addTab(page);

  await tabs(page).nth(0).click({ button: 'right' });
  await page.locator('.wp-tab-menu button', { hasText: 'Duplicate' }).click();

  await expect(tabLabels(page)).toHaveText([
    'Original Doc',
    'Original Doc (copy)',
    'Untitled',
  ]);

  await tabs(page).nth(1).locator('.wp-tab-label').click();
  await expect(page.locator('.preview')).toContainText('shared body');
});

test('dragging a tab reorders it, and the order survives a reload', async ({
  page,
}) => {
  await boot(page);
  await setText(page, '# Alpha');
  await addTab(page);
  await setText(page, '# Beta');
  await addTab(page);
  await setText(page, '# Gamma');
  await expect(saveStatus(page)).toHaveText('Saved');
  await expect(tabLabels(page)).toHaveText(['Alpha', 'Beta', 'Gamma']);

  await dragTabOnto(page, 2, 0);
  await expect(tabLabels(page)).toHaveText(['Gamma', 'Alpha', 'Beta']);

  await reload(page);
  await expect(tabLabels(page)).toHaveText(['Gamma', 'Alpha', 'Beta']);
});

test('a click on a tab still activates it after a drag has happened', async ({
  page,
}) => {
  await boot(page);
  await setText(page, '# Alpha');
  await addTab(page);
  await setText(page, '# Beta');

  await dragTabOnto(page, 1, 0);
  await expect(tabLabels(page)).toHaveText(['Beta', 'Alpha']);

  // The drag ends in a click on the dragged tab; that click must be swallowed,
  // but the next real one must not be.
  await tabs(page).nth(1).locator('.wp-tab-label').click();
  await expect(page.locator('.preview h1')).toHaveText('Alpha');
});

test('tabs and the active document survive a reload', async ({ page }) => {
  await boot(page);
  await setText(page, '# First');
  await addTab(page);
  await setText(page, '# Second');
  await addTab(page);
  await setText(page, '# Third');
  await tabs(page).nth(1).locator('.wp-tab-label').click();
  await expect(page.locator('.preview h1')).toHaveText('Second');
  await expect(saveStatus(page)).toHaveText('Saved');

  await reload(page);

  await expect(tabLabels(page)).toHaveText(['First', 'Second', 'Third']);
  await expect(activeTab(page).locator('.wp-tab-label')).toHaveText('Second');
  await expect(page.locator('.preview h1')).toHaveText('Second');
});

test('beyond ten tabs the strip scrolls rather than shrinking them', async ({
  page,
}) => {
  await boot(page);
  for (let i = 0; i < 11; i += 1) await addTab(page);
  await expect(tabs(page)).toHaveCount(12);

  const { scrollWidth, clientWidth } = await strip(page).evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollWidth).toBeGreaterThan(clientWidth);

  // Scrolling must reach the last tab rather than clipping it away.
  await strip(page).evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await expect(tabs(page).last()).toBeInViewport();
});

test('the strip is chrome and never reaches the PDF', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'page.pdf() is Chromium-only');
  await boot(page);
  await tabs(page).first().click({ button: 'right' });
  await setText(page, '# Printed');

  const buffer = await page.pdf({ format: 'A4' });
  const text = buffer.toString('latin1');
  expect(text).not.toContain('Duplicate');
  expect(text).not.toContain('Untitled');
});
