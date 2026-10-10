import { test, expect } from '@playwright/test';
import { boot, setText, resetEverything } from './_helpers.js';

/**
 * Empty states.
 *
 * The brief expects zero documents to be reachable after a Reset. It is not:
 * `useDocuments` seeds a default document whenever the store loads empty, and
 * Reset ends in a reload — so the app comes back with one document, not none.
 * Deleting the last document reseeds for the same reason (6b.2 pinned that as
 * "closing the only tab leaves a fresh empty one").
 *
 * So the workspace empty state is a guard, not a screen users reach; it is
 * covered as a unit test where the state can actually be produced. What is
 * reachable — and asserted here — is an empty *filtered* list, and the fact
 * that Reset lands somewhere usable rather than on a bound-to-nothing editor.
 */

test('reset lands on a usable document rather than an empty shell', async ({
  page,
}) => {
  await boot(page);
  await setText(page, '# Something To Lose');
  await expect(page.locator('.wp-doc-row')).toHaveCount(1);

  await resetEverything(page);

  // Seeded, not empty — this is the behaviour, and it is why the workspace
  // empty state cannot be reached from here.
  await expect(page.locator('.wp-doc-row')).toHaveCount(1);
  await expect(page.locator('.wp-topbar')).toBeVisible();
  await expect(page.locator('.wp-empty-workspace')).toHaveCount(0);
  await expect(page.locator('.preview')).toBeVisible();

  // The document is genuinely usable, not a husk left by the reset.
  await setText(page, '# After Reset');
  await expect(page.locator('.preview h1')).toHaveText('After Reset');
});

test('deleting the last document reseeds rather than emptying', async ({
  page,
}) => {
  await boot(page);
  await setText(page, '# Only One');
  await expect(page.locator('.wp-doc-row')).toHaveCount(1);

  await page.locator('.wp-doc-row').hover();
  await page.getByRole('button', { name: /^Close / }).click();

  await expect(page.locator('.wp-doc-row')).toHaveCount(1);
  await expect(page.locator('.wp-empty-workspace')).toHaveCount(0);
});

test('a search matching nothing shows the sidebar empty state', async ({
  page,
}) => {
  // The one empty state a user can actually produce.
  await boot(page);
  await setText(page, '# Alpha');
  await page.getByLabel('Search documents').fill('zzzznope');

  await expect(page.locator('.wp-doc-row')).toHaveCount(0);
  await expect(page.locator('.wp-sidebar-empty')).toContainText(
    'No documents match',
  );
  // The workspace keeps the active document: filtering the list is not the
  // same as having none.
  await expect(page.locator('.wp-topbar')).toBeVisible();
  await expect(page.locator('.preview h1')).toHaveText('Alpha');
});
