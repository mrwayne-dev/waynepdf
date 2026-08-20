import { test, expect } from '@playwright/test';
import { boot, openPreferences } from './_helpers.js';

/** The custom-theme editor: create, edit, live preview, validation, delete. */

const CUSTOM_KEY = 'waynepdf.customThemes.v1';

const section = (page) => page.locator('.wp-custom-themes');
const modal = (page) => page.locator('.wp-modal');
const newButton = (page) => page.locator('.wp-new-theme');
const row = (page, token) =>
  page.locator(`.wp-color-row[data-token="${token}"]`);

/*
 * The list is its own preferences section now and renders open, so there is no
 * disclosure to click — 7.0 replaced two clicks with one.
 */
/**
 * Counts the custom swatches, in the section that renders them.
 *
 * 7.0 put the swatch row in Appearance and the manager in Themes, so a test
 * that creates a theme in one and counts it in the other has to navigate. The
 * split is deliberate — the row is for picking, the list is for editing — but it
 * makes "did my new theme appear" a two-section question. Returns to Themes so
 * callers can keep working where they were.
 */
async function expectCustomSwatches(page, count) {
  await openPreferences(page, 'appearance');
  await expect(page.locator('.wp-swatch.is-custom')).toHaveCount(count);
  await openPreferences(page, 'themes');
}

const openSection = async (page) => {
  await boot(page);
  await openPreferences(page, 'themes');
  await expect(section(page)).toBeVisible();
};

const seed = (page, themes) =>
  page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, v),
    [CUSTOM_KEY, JSON.stringify(themes)],
  );

const dataTheme = (page) =>
  page.evaluate(() => document.documentElement.dataset.theme);

const previewBg = (page) =>
  page.evaluate(
    () =>
      getComputedStyle(document.querySelector('.wp-theme-preview'))
        .backgroundColor,
  );

test('the section reports the count and opens the editor', async ({ page }) => {
  await openSection(page);
  await expect(section(page)).toContainText('0 of 10 used');
  await expect(modal(page)).toHaveCount(0);

  await newButton(page).click();
  await expect(modal(page)).toBeVisible();
  await expect(page.locator('.wp-modal-title')).toHaveText('New custom theme');
  // Eight editable tokens, no more.
  await expect(page.locator('.wp-color-row')).toHaveCount(8);
});

test('creating a theme saves it, activates it and lists it', async ({
  page,
}) => {
  await openSection(page);
  await newButton(page).click();

  await page.locator('#wp-theme-name').fill('Ocean');
  await page.locator('#wp-theme-base').selectOption('dark');
  await row(page, '--wp-color-canvas').locator('.wp-color-hex').fill('#001b2e');
  await row(page, '--wp-color-canvas').locator('.wp-color-hex').press('Enter');
  await row(page, '--wp-color-accent').locator('.wp-color-hex').fill('#38bdf8');
  await row(page, '--wp-color-accent').locator('.wp-color-hex').press('Enter');

  await page.locator('.wp-btn-primary').click();

  await expect(modal(page)).toHaveCount(0);
  // The swatch row and its caption are both in Appearance.
  await openPreferences(page, 'appearance');
  await expect(page.locator('.wp-swatch.is-custom')).toHaveCount(1);
  await expect(page.locator('.wp-theme-name')).toHaveText('Ocean');
  await openPreferences(page, 'themes');
  await expect.poll(() => dataTheme(page)).toMatch(/^custom-/);

  const canvas = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--wp-color-canvas')
      .trim(),
  );
  expect(canvas).toBe('#001b2e');
});

test('the live preview follows colour changes before saving', async ({
  page,
}) => {
  await openSection(page);
  await newButton(page).click();
  // The renderer is a lazy chunk; the sample only appears once it resolves.
  await expect(page.locator('.wp-theme-preview-body h2')).toBeVisible();

  const before = await previewBg(page);
  await row(page, '--wp-color-canvas').locator('.wp-color-hex').fill('#102030');
  await row(page, '--wp-color-canvas').locator('.wp-color-hex').press('Enter');

  await expect.poll(() => previewBg(page)).toBe('rgb(16, 32, 48)');
  expect(before).not.toBe('rgb(16, 32, 48)');

  // And the app behind the modal is untouched — this is a draft, not the theme.
  await expect.poll(() => dataTheme(page)).not.toMatch(/^custom-/);
});

test('a row shows inherited until customised, and reset returns it', async ({
  page,
}) => {
  await openSection(page);
  await newButton(page).click();
  const accent = row(page, '--wp-color-accent');

  await expect(accent.locator('.wp-color-state')).toHaveAttribute(
    'data-state',
    'inherited',
  );
  const inherited = await accent.locator('.wp-color-hex').inputValue();

  await accent.locator('.wp-color-hex').fill('#ff00ff');
  await accent.locator('.wp-color-hex').press('Enter');
  await expect(accent.locator('.wp-color-state')).toHaveAttribute(
    'data-state',
    'customized',
  );

  await accent.locator('.wp-color-reset').click();
  await expect(accent.locator('.wp-color-state')).toHaveAttribute(
    'data-state',
    'inherited',
  );
  await expect(accent.locator('.wp-color-hex')).toHaveValue(inherited);
});

test('an invalid hex reverts on blur rather than being stored', async ({
  page,
}) => {
  await openSection(page);
  await newButton(page).click();
  const fg = row(page, '--wp-color-fg');
  const original = await fg.locator('.wp-color-hex').inputValue();

  await fg.locator('.wp-color-hex').fill('not-a-colour');
  await fg.locator('.wp-color-hex').blur();

  await expect(fg.locator('.wp-color-hex')).toHaveValue(original);
  await expect(fg.locator('.wp-color-state')).toHaveAttribute(
    'data-state',
    'inherited',
  );
});

test('changing the base preset moves the inherited colours', async ({
  page,
}) => {
  await openSection(page);
  await newButton(page).click();
  const canvas = row(page, '--wp-color-canvas').locator('.wp-color-hex');
  await expect(canvas).toHaveValue('#ffffff');

  await page.locator('#wp-theme-base').selectOption('dark');
  await expect(canvas).toHaveValue('#0d1117');
});

test('a duplicate name is rejected with a message', async ({ page }) => {
  await seed(page, [
    { id: 'aaaa', name: 'Taken', basedOn: 'light', overrides: {} },
  ]);
  await openSection(page);
  await newButton(page).click();

  await page.locator('#wp-theme-name').fill('taken');
  await page.locator('.wp-btn-primary').click();

  await expect(page.locator('.wp-modal-error')).toContainText('exists');
  await expect(modal(page)).toBeVisible();
  /*
   * Counted in the list behind the modal rather than by visiting Appearance:
   * the modal is still open — that is the point of the test — and it covers the
   * rail, so navigating would be a click into an overlay. The list rows answer
   * the real question anyway, which is whether a second theme got created.
   */
  await expect(page.locator('.wp-custom-theme-row')).toHaveCount(1);
});

test('save is disabled until the theme has a name', async ({ page }) => {
  await openSection(page);
  await newButton(page).click();
  await expect(page.locator('.wp-btn-primary')).toBeDisabled();
  await page.locator('#wp-theme-name').fill('Named');
  await expect(page.locator('.wp-btn-primary')).toBeEnabled();
});

test('editing preloads the current values', async ({ page }) => {
  await seed(page, [
    {
      id: 'bbbb',
      name: 'Existing',
      basedOn: 'sepia',
      overrides: { '--wp-color-accent': '#123456' },
    },
  ]);
  await openSection(page);
  await page
    .locator('.wp-custom-theme-row .wp-btn-ghost', { hasText: 'Edit' })
    .click();

  await expect(page.locator('.wp-modal-title')).toHaveText('Edit custom theme');
  await expect(page.locator('#wp-theme-name')).toHaveValue('Existing');
  await expect(page.locator('#wp-theme-base')).toHaveValue('sepia');
  await expect(
    row(page, '--wp-color-accent').locator('.wp-color-hex'),
  ).toHaveValue('#123456');
  await expect(
    row(page, '--wp-color-accent').locator('.wp-color-state'),
  ).toHaveAttribute('data-state', 'customized');
});

test('cancel and Esc both close without saving', async ({ page }) => {
  await openSection(page);
  await newButton(page).click();
  await page.locator('#wp-theme-name').fill('Discarded');
  await page.locator('.wp-btn-ghost', { hasText: 'Cancel' }).click();
  await expect(modal(page)).toHaveCount(0);
  await expectCustomSwatches(page, 0);

  await newButton(page).click();
  await page.locator('#wp-theme-name').fill('Also discarded');
  await page.keyboard.press('Escape');
  await expect(modal(page)).toHaveCount(0);
  // Esc must not also close the preferences window behind it. The window's own
  // Esc handler checks defaultPrevented for exactly this reason.
  await expect(page.locator('.wp-prefs')).toBeVisible();
  await expectCustomSwatches(page, 0);
});

test('a backdrop click closes the modal', async ({ page }) => {
  await openSection(page);
  await newButton(page).click();
  await page.locator('.wp-modal-overlay').click({ position: { x: 5, y: 5 } });
  await expect(modal(page)).toHaveCount(0);
});

test('delete confirms and removes the theme', async ({ page }) => {
  await seed(page, [
    { id: 'cccc', name: 'Doomed', basedOn: 'light', overrides: {} },
  ]);
  await openSection(page);
  await expectCustomSwatches(page, 1);

  page.once('dialog', (d) => d.dismiss());
  await page
    .locator('.wp-custom-theme-row .wp-btn-ghost', { hasText: 'Delete' })
    .click();
  await expectCustomSwatches(page, 1);

  page.once('dialog', (d) => d.accept());
  await page
    .locator('.wp-custom-theme-row .wp-btn-ghost', { hasText: 'Delete' })
    .click();
  await expectCustomSwatches(page, 0);
  await expect(section(page)).toContainText('0 of 10 used');
});

test('the new-theme button is disabled at the limit', async ({ page }) => {
  await seed(
    page,
    Array.from({ length: 10 }, (_, i) => ({
      id: `id-${i}`,
      name: `Theme ${i}`,
      basedOn: 'light',
      overrides: {},
    })),
  );
  await openSection(page);
  await expect(section(page)).toContainText('10 of 10 used');
  await expect(newButton(page)).toBeDisabled();
  await expect(newButton(page)).toHaveAttribute('title', /limit reached/i);
});
