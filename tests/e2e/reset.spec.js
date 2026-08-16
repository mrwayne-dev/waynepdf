import { test, expect } from '@playwright/test';
import { boot, setText, resetEverything } from './_helpers.js';

/**
 * Reset, end to end.
 *
 * The registry landed in 6b.0 and documents joined it in 6b.1, so Reset now has
 * to clear four localStorage keys, both IndexedDB stores, and every container —
 * in one click, with one confirmation.
 */

const gear = (page) => page.locator('button.wp-gear');
const themeAttr = (page) =>
  page.evaluate(() => document.documentElement.dataset.theme);

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

const waynepdfKeys = (page) =>
  page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('waynepdf.')),
  );

test('Reset clears the document and the theme together', async ({ page }) => {
  await boot(page);
  await setText(page, '# Unique Content Marker');
  await expect(page.locator('.save-status')).toHaveText('Saved');

  await gear(page).click();
  await page.locator('button.wp-swatch[data-theme="dark"]').click();
  await expect.poll(() => themeAttr(page)).toBe('dark');

  await resetEverything(page);

  await expect.poll(() => themeAttr(page)).toBe('light');
  await expect(page.locator('.preview')).not.toContainText(
    'Unique Content Marker',
  );
});

test('Reset leaves exactly the default document behind, not the old one', async ({
  page,
}) => {
  await boot(page);
  await setText(page, '# Doomed');
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await gear(page).click();

  await resetEverything(page);

  /*
   * Not "the store is empty": resetAll empties it, then the reload immediately
   * re-runs the first-launch migration. One default document is the correct
   * end state, and asserting emptiness would be asserting a state the user
   * never actually sees.
   */
  const docs = await storedDocuments(page);
  expect(docs).toHaveLength(1);
  expect(docs[0].body).not.toContain('Doomed');
  expect(docs[0].body).toContain('WaynePDF');
});

test('Reset clears every settings key, including ones the old button missed', async ({
  page,
}) => {
  await boot(page);
  await gear(page).click();
  await page.locator('button.wp-swatch[data-theme="sepia"]').click();
  await page.locator('select.wp-select-language').selectOption('ar');
  await page.locator('select.wp-select-page-size').selectOption('a3');

  await expect
    .poll(async () => (await waynepdfKeys(page)).sort())
    .toEqual([
      'waynepdf.language.v1',
      'waynepdf.layout.v1',
      'waynepdf.settings.v1',
    ]);

  await resetEverything(page);

  // The keys come straight back — each container persists its defaults on
  // mount — so the check that matters is their contents.
  const settings = await page.evaluate(() => ({
    theme: JSON.parse(localStorage.getItem('waynepdf.settings.v1')).theme,
    lang: JSON.parse(localStorage.getItem('waynepdf.language.v1')).lang,
    pageSize: JSON.parse(localStorage.getItem('waynepdf.layout.v1')).pageSize,
  }));
  expect(settings).toEqual({ theme: 'system', lang: 'auto', pageSize: 'a4' });
});

test('Reset leaves other origins-worth of storage alone', async ({ page }) => {
  await boot(page);
  await page.evaluate(() =>
    localStorage.setItem('somethingElse.state', 'keep me'),
  );
  await gear(page).click();

  await resetEverything(page);

  expect(
    await page.evaluate(() => localStorage.getItem('somethingElse.state')),
  ).toBe('keep me');
});

test('cancelling the confirmation deletes nothing', async ({ page }) => {
  await boot(page);
  await setText(page, '# Still Here');
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await gear(page).click();
  await page.locator('button.wp-swatch[data-theme="dark"]').click();
  await expect.poll(() => themeAttr(page)).toBe('dark');

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Reset everything' }).click();

  // No reload happened, so the panel is still open and everything is intact.
  await expect(page.locator('#wp-settings-panel')).toHaveClass(/is-open/);
  expect(await themeAttr(page)).toBe('dark');
  await expect(page.locator('.preview h1')).toHaveText('Still Here');

  const docs = await storedDocuments(page);
  expect(docs).toHaveLength(1);
  expect(docs[0].body).toBe('# Still Here');
});
