import { test, expect } from '@playwright/test';
import { boot, setText, themeSettings, prefs } from './_helpers.js';

/**
 * The sidebar itself: structure, search, footer.
 *
 * The document behaviours it hosts — create, switch, close, rename, duplicate,
 * reorder, persistence — live in documents.spec.js, which migrated from the tab
 * strip along with them. This file covers what 7.1 actually added.
 */

const sidebar = (page) => page.locator('.wp-sidebar');
const rows = (page) => page.locator('.wp-doc-row');
const labels = (page) => page.locator('.wp-doc-label');
const search = (page) => page.getByLabel('Search documents');
const newDoc = (page) => page.locator('.wp-sidebar-new');

/** Adds a document with a known title and waits for it to land in the list. */
async function addDocument(page, title) {
  const before = await rows(page).count();
  await newDoc(page).click();
  await expect(rows(page)).toHaveCount(before + 1);
  await setText(page, `# ${title}`);
  await expect(labels(page).filter({ hasText: title })).toHaveCount(1);
}

test.describe('structure', () => {
  test('every speced element is present', async ({ page }) => {
    await boot(page);
    await expect(sidebar(page)).toBeVisible();
    await expect(page.locator('.wp-sidebar-wordmark')).toHaveText('WaynePDF');
    await expect(newDoc(page)).toBeVisible();
    await expect(search(page)).toBeVisible();
    await expect(page.locator('.wp-doc-list')).toBeVisible();
    await expect(page.locator('.wp-sidebar-foot .wp-gear')).toBeVisible();
    await expect(page.locator('.wp-sidebar-foot .wp-theme-toggle')).toBeVisible();
  });

  test('it is 260px wide and full height', async ({ page }) => {
    /*
     * The width is spec, and it is also the one thing a stray `min-width: auto`
     * can silently undo: a flex item's automatic minimum beats flex-basis, and
     * the search input's intrinsic width had the rail at 394px while the
     * declared `flex: 0 0 260px` computed correctly and did nothing.
     */
    await boot(page);
    const box = await sidebar(page).boundingBox();
    // 260 plus the 1px right border.
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(260);
    expect(Math.round(box.width)).toBeLessThanOrEqual(261);
    expect(Math.round(box.height)).toBe(
      page.viewportSize().height,
    );
  });

  test('the wordmark is in the sidebar and not duplicated in the top bar', async ({
    page,
  }) => {
    /*
     * Scoped to the two chrome elements rather than a page-wide text search:
     * getByText matches every ancestor whose text is exactly the string, so a
     * single wordmark in a <p> inside two wrappers counts as three.
     */
    await boot(page);
    await expect(page.locator('.wp-sidebar-wordmark')).toHaveCount(1);
    /*
     * Asserted as the absence of the wordmark element, not of the string. The
     * default document is titled "WaynePDF" — its first heading names the app —
     * so the top bar legitimately contains those letters as a document title.
     * A text assertion here passed until 7.2 put the title in the bar, then
     * failed for a reason that had nothing to do with wordmarks.
     */
    await expect(page.locator('.wp-topbar')).toHaveCount(1);
    await expect(page.locator('.wp-topbar .wp-sidebar-wordmark')).toHaveCount(0);
    await expect(page.locator('.wp-topbar .project')).toHaveCount(0);
  });

  test('the active document is marked in the list', async ({ page }) => {
    await boot(page);
    await setText(page, '# First');
    await addDocument(page, 'Second');

    const active = page.locator('.wp-doc-row.is-active');
    await expect(active).toHaveCount(1);
    await expect(active.locator('.wp-doc-label')).toHaveText('Second');
    await expect(active.locator('.wp-doc-label')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('clicking a row activates that document', async ({ page }) => {
    await boot(page);
    await setText(page, '# First');
    await addDocument(page, 'Second');

    await labels(page).filter({ hasText: 'First' }).click();
    await expect(page.locator('.preview h1')).toHaveText('First');
  });
});

test.describe('search', () => {
  test('filters the list by title substring', async ({ page }) => {
    await boot(page);
    await setText(page, '# Alpha Report');
    await addDocument(page, 'Beta Notes');
    await addDocument(page, 'Gamma Report');
    await expect(rows(page)).toHaveCount(3);

    await search(page).fill('report');
    await expect(labels(page)).toHaveText(['Alpha Report', 'Gamma Report']);
  });

  test('clearing restores the full list', async ({ page }) => {
    await boot(page);
    await setText(page, '# Alpha');
    await addDocument(page, 'Beta');

    await search(page).fill('alph');
    await expect(rows(page)).toHaveCount(1);

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(search(page)).toHaveValue('');
  });

  test('says so when nothing matches', async ({ page }) => {
    await boot(page);
    await setText(page, '# Alpha');
    await search(page).fill('zzzznope');
    await expect(rows(page)).toHaveCount(0);
    await expect(page.locator('.wp-sidebar-empty')).toContainText(
      'No documents match',
    );
  });

  test('a filtered list does not reorder on drag', async ({ page }) => {
    /*
     * Dragging inside a filtered view would move a row past neighbours the user
     * cannot see, so reordering is disabled while a filter is on. Asserting it
     * because the alternative failure is silent and destructive: the order
     * changes and nothing on screen explains why.
     */
    await boot(page);
    await setText(page, '# Alpha');
    await addDocument(page, 'Beta');
    await addDocument(page, 'Gamma');
    await expect(labels(page)).toHaveText(['Alpha', 'Beta', 'Gamma']);

    await search(page).fill('a');
    const visible = await labels(page).allTextContents();
    expect(visible.length).toBeGreaterThan(1);

    const from = await rows(page).nth(1).boundingBox();
    const to = await rows(page).nth(0).boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height * 0.25, {
      steps: 8,
    });
    await page.mouse.up();

    await search(page).fill('');
    await expect(labels(page)).toHaveText(['Alpha', 'Beta', 'Gamma']);
  });
});

test.describe('long lists', () => {
  test('creating a document scrolls it into view', async ({ page }) => {
    /*
     * A list of twenty-five does not fit, so "+ New Document" at the top of a
     * long list would otherwise create a document, activate it, and leave the
     * user looking at rows belonging to something else. Tabs never needed this
     * because six of them always fit.
     */
    await boot(page);
    await setText(page, '# First');
    for (let i = 0; i < 24; i += 1) {
      await newDoc(page).click();
      await expect(rows(page)).toHaveCount(i + 2);
    }
    await setText(page, '# Last One');

    const active = page.locator('.wp-doc-row.is-active');
    await expect(active.locator('.wp-doc-label')).toHaveText('Last One');
    await expect(active).toBeInViewport();
  });
});

test.describe('footer', () => {
  test('the gear opens preferences', async ({ page }) => {
    await boot(page);
    await expect(prefs(page)).toHaveCount(0);
    await page.locator('.wp-sidebar-foot .wp-gear').click();
    await expect(prefs(page)).toBeVisible();
  });

  test('the theme toggle cycles light, dark, system', async ({ page }) => {
    await boot(page, { theme: themeSettings({ theme: 'light' }) });
    const toggle = page.locator('.wp-theme-toggle');

    await expect(toggle).toHaveAttribute('data-theme-toggle', 'light');
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-theme-toggle', 'dark');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe('dark');

    await toggle.click();
    await expect(toggle).toHaveAttribute('data-theme-toggle', 'system');

    await toggle.click();
    await expect(toggle).toHaveAttribute('data-theme-toggle', 'light');
  });

  test('a theme outside the cycle enters it rather than being swallowed', async ({
    page,
  }) => {
    /*
     * Sepia, High Contrast, Print Optimized and any custom theme are reachable
     * from preferences but are not cycle stops. The first click from one has to
     * go somewhere sensible instead of finding no next value.
     */
    await boot(page, { theme: themeSettings({ theme: 'sepia' }) });
    const toggle = page.locator('.wp-theme-toggle');
    await expect(toggle).toHaveAttribute('data-theme-toggle', 'sepia');

    await toggle.click();
    await expect(toggle).toHaveAttribute('data-theme-toggle', 'light');
  });

  test('the toggle writes through to stored settings', async ({ page }) => {
    /*
     * Persistence is asserted at the storage key rather than across a reload:
     * boot() seeds the theme with addInitScript, which re-runs on every
     * navigation, so a reload here would restore the seed and prove nothing
     * about the click. The stored value is the thing a reload would read.
     */
    await boot(page, { theme: themeSettings({ theme: 'light' }) });
    await page.locator('.wp-theme-toggle').click();

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('waynepdf.settings.v1') ?? '{}')
              .theme,
        ),
      )
      .toBe('dark');
  });
});

test.describe('the tab strip is gone', () => {
  test('nothing in the app renders a tab strip', async ({ page }) => {
    // The 7.1 deletion invariant. A leftover strip would be a second,
    // desynchronised way to switch documents.
    await boot(page);
    for (const selector of [
      '.wp-tabs',
      '.wp-tabs-list',
      '.wp-tab',
      '.wp-tab-label',
      '.wp-tab-new',
    ]) {
      await expect(page.locator(selector)).toHaveCount(0);
    }
  });
});
