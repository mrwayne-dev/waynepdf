import { test, expect } from '@playwright/test';
import { boot, prefs, openPreferences } from './_helpers.js';

/** The global shortcuts, and the guard that keeps them out of the editor. */

const accel = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Focus a plain button, so the typing guard is not what is being tested. */
const focusChrome = (page) =>
  page.getByRole('button', { name: 'Flowing' }).focus();

test.describe('preferences', () => {
  test('the accelerator opens it from chrome', async ({ page }) => {
    await boot(page);
    await focusChrome(page);
    await page.keyboard.press(`${accel}+Comma`);
    await expect(prefs(page)).toBeVisible();
  });

  test('it does not fire from inside the editor', async ({ page }) => {
    /*
     * Specified rather than derived — Cmd+, is not a text-editing key in any
     * editor, so it could safely fire here. The rule is that shortcuts yield to
     * text fields, and CodeMirror is the field users spend their time in.
     */
    await boot(page);
    await page.locator('.CodeMirror textarea').first().focus();
    await page.keyboard.press(`${accel}+Comma`);
    await expect(prefs(page)).toHaveCount(0);
  });

  test('the accelerator closes it again', async ({ page }) => {
    /*
     * Opening moves focus into the search box, which is a text field — so
     * without a carve-out for the preferences window itself the toggle could
     * open and never close.
     */
    await boot(page);
    await focusChrome(page);
    await page.keyboard.press(`${accel}+Comma`);
    await expect(prefs(page)).toBeVisible();
    await page.keyboard.press(`${accel}+Comma`);
    await expect(prefs(page)).toHaveCount(0);
  });

  test('Escape closes it', async ({ page }) => {
    await boot(page);
    await openPreferences(page);
    await page.keyboard.press('Escape');
    await expect(prefs(page)).toHaveCount(0);
  });

  test('arrow keys move through the rail', async ({ page }) => {
    await boot(page);
    await openPreferences(page);
    const rail = (id) =>
      page.locator(`.wp-prefs-rail-item[data-section="${id}"]`);

    await rail('appearance').focus();
    await page.keyboard.press('ArrowDown');
    await expect(rail('editor')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(rail('document')).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('new document', () => {
  test('the accelerator creates one and activates it', async ({ page }) => {
    await boot(page);
    await expect(page.locator('.wp-doc-row')).toHaveCount(1);

    await focusChrome(page);
    await page.keyboard.press(`${accel}+KeyN`);

    await expect(page.locator('.wp-doc-row')).toHaveCount(2);
    await expect(page.locator('.wp-doc-row.is-active')).toHaveCount(1);
  });

  test('it does not fire from inside the editor', async ({ page }) => {
    // A new document mid-sentence is a jarring context switch, and Cmd+N is
    // close enough to keys that do fire in an editor to be worth guarding.
    await boot(page);
    await expect(page.locator('.wp-doc-row')).toHaveCount(1);

    await page.locator('.CodeMirror textarea').first().focus();
    await page.keyboard.press(`${accel}+KeyN`);

    await expect(page.locator('.wp-doc-row')).toHaveCount(1);
  });
});

test.describe('unbound', () => {
  test('the command-palette accelerator is reserved, not stubbed', async ({
    page,
  }) => {
    /*
     * Cmd+K is deliberately bound to nothing. A stub that logged "coming soon"
     * would claim the key from browser extensions that already use it, in
     * exchange for a message nobody asked for.
     */
    await boot(page);
    await focusChrome(page);
    await page.keyboard.press(`${accel}+KeyK`);

    await expect(prefs(page)).toHaveCount(0);
    await expect(page.locator('.wp-doc-row')).toHaveCount(1);
  });
});
