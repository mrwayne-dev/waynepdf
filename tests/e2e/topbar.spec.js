import { test, expect } from '@playwright/test';
import { boot, setText, themeSettings } from './_helpers.js';

/**
 * The top bar: what it holds, and — just as much — what it no longer holds.
 */

const bar = (page) => page.locator('.wp-topbar');
const title = (page) => page.locator('.wp-title');
const dot = (page) => page.locator('.wp-autosave-dot');

test.describe('structure', () => {
  test('it is 44px and holds the four speced elements', async ({ page }) => {
    await boot(page);
    const box = await bar(page).boundingBox();
    // 44 plus the 1px bottom border.
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height)).toBeLessThanOrEqual(45);

    await expect(title(page)).toBeVisible();
    await expect(dot(page)).toHaveCount(1);
    await expect(page.locator('.wp-modes')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Save as/ })).toBeVisible();
  });

  test('the things that moved to the sidebar are gone from it', async ({
    page,
  }) => {
    /*
     * The 7.2 deletion invariant. Each of these has a home in the sidebar now;
     * a leftover copy here would be a second control for the same state, and
     * the two would drift.
     */
    await boot(page);
    await expect(bar(page).locator('.wp-sidebar-wordmark')).toHaveCount(0);
    await expect(bar(page).locator('.wp-gear')).toHaveCount(0);
    await expect(bar(page).locator('.wp-sidebar-open')).toHaveCount(0);
    await expect(bar(page).locator('.project')).toHaveCount(0);
    // The page count moved into the paginated preview.
    await expect(bar(page).locator('.page-count')).toHaveCount(0);
  });

  test('the old header shell is gone from the app entirely', async ({
    page,
  }) => {
    await boot(page);
    for (const selector of ['.page-count', 'header .project', 'header .mode']) {
      await expect(page.locator(selector)).toHaveCount(0);
    }
  });
});

test.describe('document title', () => {
  test('shows the active document and renames in place', async ({ page }) => {
    await boot(page);
    await setText(page, '# Before');
    await expect(title(page)).toHaveText('Before');

    await title(page).click();
    const input = page.getByLabel('Rename document');
    await input.fill('After');
    await input.press('Enter');

    await expect(title(page)).toHaveText('After');
    // The sidebar row is the same document and must agree.
    await expect(
      page.locator('.wp-doc-row.is-active .wp-doc-label'),
    ).toHaveText('After');
  });

  test('Escape reverts a rename', async ({ page }) => {
    await boot(page);
    await setText(page, '# Keep This');
    await title(page).click();

    const input = page.getByLabel('Rename document');
    await input.fill('Discarded');
    await input.press('Escape');

    await expect(title(page)).toHaveText('Keep This');
  });

  test('blur commits, the way a file name does everywhere else', async ({
    page,
  }) => {
    await boot(page);
    await setText(page, '# Before Blur');
    await title(page).click();

    const input = page.getByLabel('Rename document');
    await input.fill('After Blur');
    await input.blur();

    await expect(title(page)).toHaveText('After Blur');
  });

  test('an empty title is treated as a cancel', async ({ page }) => {
    // Storing it would leave the sidebar row blank and the document unfindable.
    await boot(page);
    await setText(page, '# Has A Name');
    await title(page).click();

    const input = page.getByLabel('Rename document');
    await input.fill('   ');
    await input.press('Enter');

    await expect(title(page)).toHaveText('Has A Name');
  });

  test('it follows the active document', async ({ page }) => {
    await boot(page);
    await setText(page, '# First');
    await page.locator('.wp-sidebar-new').click();
    await expect(page.locator('.wp-doc-row')).toHaveCount(2);
    await setText(page, '# Second');
    await expect(title(page)).toHaveText('Second');

    await page.locator('.wp-doc-label').filter({ hasText: 'First' }).click();
    await expect(title(page)).toHaveText('First');
  });
});

test.describe('autosave dot', () => {
  test('it settles on saved and carries the label for screen readers', async ({
    page,
  }) => {
    await boot(page);
    await setText(page, '# Saved Please');
    await expect(dot(page)).toHaveAttribute('data-save-status', 'saved');
    // The colour is the visible signal; the text is what assistive tech reads.
    await expect(dot(page)).toHaveText('Saved');
    await expect(dot(page)).toHaveAttribute('title', 'Saved');
  });

  test('it turns amber while a save is pending', async ({ page }) => {
    await boot(page);
    await setText(page, '# Pending');
    await expect(dot(page)).toHaveAttribute('data-save-status', 'saving');
    await expect(dot(page)).toHaveText('Saving…');
    await expect(dot(page)).toHaveAttribute('data-save-status', 'saved');
  });

  test('each state paints a different colour', async ({ page }) => {
    /*
     * Three states that all look identical would be a decorative dot. Compared
     * rather than hardcoded, because the values are theme tokens.
     */
    await boot(page, { theme: themeSettings() });
    const colourFor = (state) =>
      page.evaluate((s) => {
        const el = document.querySelector('.wp-autosave-dot');
        /*
         * transition:none before reading. The dot animates its background, and
         * getComputedStyle mid-transition returns the value it is animating
         * *from* — so all three states read back as the saved green and the
         * test passed on a dot that never changed colour.
         */
        el.style.transition = 'none';
        el.className = `wp-autosave-dot is-${s}`;
        return getComputedStyle(el).backgroundColor;
      }, state);

    const saved = await colourFor('saved');
    const saving = await colourFor('saving');
    const error = await colourFor('error');

    expect(new Set([saved, saving, error]).size).toBe(3);
  });
});

test.describe('mode toggle and export', () => {
  test('the toggle switches between Flowing and Paged', async ({ page }) => {
    await boot(page);
    const flowing = page.getByRole('button', { name: 'Flowing' });
    const paged = page.getByRole('button', { name: 'Paged' });

    await expect(flowing).toHaveAttribute('aria-pressed', 'true');
    await paged.click();
    await expect(paged).toHaveAttribute('aria-pressed', 'true');
    await expect(flowing).toHaveAttribute('aria-pressed', 'false');
  });

  test('the export split button still offers all three formats', async ({
    page,
  }) => {
    await boot(page);
    // .wp-export-item, not [role="menuitem"] — 6d.1 deliberately declined the
    // menu role rather than half-implement the keyboard contract it owes.
    await page.locator('.wp-export-caret').click();
    await expect(page.locator('.wp-export-menu .wp-export-item')).toHaveCount(3);
  });
});
