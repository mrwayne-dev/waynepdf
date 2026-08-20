import { test, expect } from '@playwright/test';
import { boot } from './_helpers.js';

/** The split button and its format menu. */

const mainButton = (page) => page.locator('.wp-export-main');
const caret = (page) => page.locator('.wp-export-caret');
const menu = (page) => page.locator('.wp-export-menu');
const item = (page, format) =>
  page.locator(`.wp-export-item[data-format="${format}"]`);

const reload = async (page) => {
  await page.reload();
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
};

test('the main button names the active format', async ({ page }) => {
  await boot(page);
  await expect(mainButton(page)).toHaveText('Save as PDF');
  await expect(menu(page)).toHaveCount(0);
});

test('the caret opens the menu and Esc closes it', async ({ page }) => {
  await boot(page);
  await caret(page).click();
  await expect(menu(page)).toBeVisible();
  await expect(page.locator('.wp-export-item')).toHaveCount(3);

  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
});

test('a click outside closes the menu', async ({ page }) => {
  await boot(page);
  await caret(page).click();
  await expect(menu(page)).toBeVisible();
  await page.locator('.preview').click({ position: { x: 5, y: 5 } });
  await expect(menu(page)).toHaveCount(0);
});

test('choosing HTML updates the button and survives a reload', async ({
  page,
}) => {
  await boot(page);
  await caret(page).click();
  await item(page, 'html').click();

  await expect(menu(page)).toHaveCount(0);
  await expect(mainButton(page)).toHaveText('Save as HTML');

  await reload(page);
  await expect(mainButton(page)).toHaveText('Save as HTML');
});

test('the active format is checked in the menu', async ({ page }) => {
  await boot(page);
  await caret(page).click();
  await expect(item(page, 'pdf')).toHaveAttribute('aria-current', 'true');
  await expect(item(page, 'pdf').locator('.wp-export-check')).toHaveCount(1);
  await expect(item(page, 'html').locator('.wp-export-check')).toHaveCount(0);
});

test('DOCX is present, disabled, and says why', async ({ page }) => {
  await boot(page);
  await caret(page).click();
  const docx = item(page, 'docx');
  await expect(docx).toBeVisible();
  await expect(docx).toBeDisabled();
  await expect(docx).toContainText('coming in 6d.2');

  // A disabled item must not change the format even if something clicks it.
  await docx.click({ force: true }).catch(() => {});
  await expect(mainButton(page)).toHaveText('Save as PDF');
});

test('arrow keys move through the menu and Enter selects', async ({ page }) => {
  await boot(page);
  await caret(page).click();
  await expect(menu(page)).toBeVisible();

  await page.keyboard.press('ArrowDown');
  await expect(item(page, 'html')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(menu(page)).toHaveCount(0);
  await expect(mainButton(page)).toHaveText('Save as HTML');
});

test('arrow-up wraps to the end of the list', async ({ page }) => {
  await boot(page);
  await caret(page).click();
  await page.keyboard.press('ArrowUp');
  await expect(item(page, 'docx')).toBeFocused();
});

test('the menu never reaches the printed PDF', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'page.pdf() is Chromium-only');
  await boot(page);
  await caret(page).click();
  await expect(menu(page)).toBeVisible();

  const buffer = await page.pdf({ format: 'A4', printBackground: true });
  const text = buffer.toString('latin1');
  for (const chrome of ['Save as PDF', 'Save as HTML', 'coming in 6d.2']) {
    expect(text, `"${chrome}" leaked into the PDF`).not.toContain(chrome);
  }
});
