import { test, expect } from '@playwright/test';
import { boot, resetEverything } from './_helpers.js';

/*
 * Custom themes at the state level. 6c.1 ships no editor UI, so themes are
 * seeded through localStorage — which is also the hostile-input path, so it is
 * worth exercising directly.
 */

const CUSTOM_KEY = 'waynepdf.customThemes.v1';
const THEME_KEY = 'waynepdf.settings.v1';

const themeSettings = (theme) =>
  JSON.stringify({
    theme,
    fontFamily: 'sans',
    fontSize: 16,
    lineHeight: 1.6,
    codeFontSize: 14,
    mathCopyEnabled: true,
    sanitizeHtml: false,
  });

const OCEAN = {
  id: '11111111-2222-3333-4444-555555555555',
  name: 'Ocean',
  basedOn: 'dark',
  overrides: {
    '--wp-color-canvas': '#001b2e',
    '--wp-color-accent': '#38bdf8',
  },
  createdAt: 1,
  updatedAt: 1,
};

const seed = (page, { themes = [OCEAN], active } = {}) =>
  page.addInitScript(
    ([ck, cv, tk, tv]) => {
      window.localStorage.setItem(ck, cv);
      if (tv) window.localStorage.setItem(tk, tv);
    },
    [
      CUSTOM_KEY,
      JSON.stringify(themes),
      THEME_KEY,
      active ? themeSettings(active) : null,
    ],
  );

const token = (page, name) =>
  page.evaluate(
    (n) =>
      getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );

const dataTheme = (page) =>
  page.evaluate(() => document.documentElement.dataset.theme);

const gear = (page) => page.locator('button.wp-gear');

test('a seeded custom theme appears after the presets, behind a divider', async ({
  page,
}) => {
  await seed(page);
  await boot(page);
  await gear(page).click();

  await expect(page.locator('.wp-swatch')).toHaveCount(7);
  await expect(page.locator('.wp-swatch.is-custom')).toHaveCount(1);
  await expect(page.locator('.wp-swatch-divider')).toHaveCount(1);
  await expect(page.locator('.wp-swatch.is-custom')).toHaveAttribute(
    'title',
    'Ocean',
  );
});

test('no divider shows when there are no custom themes', async ({ page }) => {
  await boot(page);
  await gear(page).click();
  await expect(page.locator('.wp-swatch')).toHaveCount(6);
  await expect(page.locator('.wp-swatch-divider')).toHaveCount(0);
});

test('activating a custom theme applies its palette', async ({ page }) => {
  await seed(page);
  await boot(page);
  await gear(page).click();
  await page.locator('.wp-swatch.is-custom').click();

  await expect.poll(() => dataTheme(page)).toBe(`custom-${OCEAN.id}`);
  // The overridden tokens.
  expect(await token(page, '--wp-color-canvas')).toBe('#001b2e');
  expect(await token(page, '--wp-color-accent')).toBe('#38bdf8');
  // And one the user never touched, which must still track the Dark base
  // rather than falling back to :root's Light values.
  expect(await token(page, '--wp-color-border')).toBe('#3d444d');

  await expect(page.locator('.wp-theme-name')).toHaveText('Ocean');
});

test('the page actually paints in the custom palette', async ({ page }) => {
  await seed(page, { active: `custom-${OCEAN.id}` });
  await boot(page);
  const bg = await page.evaluate(
    () => getComputedStyle(document.querySelector('.preview')).backgroundColor,
  );
  expect(bg).toBe('rgb(0, 27, 46)');
});

test('a custom theme drives the code highlighter from its base preset', async ({
  page,
}) => {
  /*
   * There is no highlight.js theme for `custom-*`. Without the base lookup a
   * Dark-based custom theme would get GitHub Light and print a light code block
   * on a dark page.
   */
  await seed(page, { active: `custom-${OCEAN.id}` });
  await boot(page);
  const enabled = await page.evaluate(() =>
    [...document.querySelectorAll('link[data-hljs-theme]')]
      .filter((l) => !l.disabled)
      .map((l) => l.id),
  );
  expect(enabled).toEqual(['hljs-github-dark']);
});

test('custom themes survive a reload, active selection included', async ({
  page,
}) => {
  await seed(page, { active: `custom-${OCEAN.id}` });
  await boot(page);
  await expect.poll(() => dataTheme(page)).toBe(`custom-${OCEAN.id}`);

  await page.reload();
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect.poll(() => dataTheme(page)).toBe(`custom-${OCEAN.id}`);
  expect(await token(page, '--wp-color-canvas')).toBe('#001b2e');
});

test('an active theme whose custom palette is gone falls back to its base', async ({
  page,
}) => {
  // The theme choice and the theme list are separate storage keys, so this is
  // reachable: keep the selection, drop the palette.
  await page.addInitScript(
    ([tk, tv]) => window.localStorage.setItem(tk, tv),
    [THEME_KEY, themeSettings(`custom-${OCEAN.id}`)],
  );
  await boot(page);

  // data-theme still names the missing custom theme; the palette resolves to
  // Light, and nothing throws.
  await expect(page.locator('.preview')).toBeVisible();
  const enabled = await page.evaluate(() =>
    [...document.querySelectorAll('link[data-hljs-theme]')]
      .filter((l) => !l.disabled)
      .map((l) => l.id),
  );
  expect(enabled).toEqual(['hljs-github']);
});

test('malformed stored themes are dropped without breaking the panel', async ({
  page,
}) => {
  await seed(page, {
    themes: [
      OCEAN,
      null,
      { name: 'no id' },
      'garbage',
      { id: 'x', name: 'Bad base', basedOn: 'neon' },
    ],
  });
  await boot(page);
  await gear(page).click();
  // Ocean plus the salvageable "Bad base"; the other three are dropped.
  await expect(page.locator('.wp-swatch.is-custom')).toHaveCount(2);
});

test('Reset clears custom themes', async ({ page }) => {
  /*
   * Seeded through evaluate + reload rather than addInitScript: an init script
   * re-runs on every navigation, including the reload Reset performs, so the key
   * would come straight back and the test would be asserting the harness.
   */
  await boot(page);
  await page.evaluate(
    ([ck, cv, tk, tv]) => {
      localStorage.setItem(ck, cv);
      localStorage.setItem(tk, tv);
    },
    [
      CUSTOM_KEY,
      JSON.stringify([OCEAN]),
      THEME_KEY,
      themeSettings(`custom-${OCEAN.id}`),
    ],
  );
  await page.reload();
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await gear(page).click();
  await expect(page.locator('.wp-swatch.is-custom')).toHaveCount(1);
  await expect.poll(() => dataTheme(page)).toBe(`custom-${OCEAN.id}`);

  await resetEverything(page);

  expect(
    await page.evaluate((k) => localStorage.getItem(k), CUSTOM_KEY),
  ).toBeNull();
  await gear(page).click();
  await expect(page.locator('.wp-swatch.is-custom')).toHaveCount(0);
  await expect.poll(() => dataTheme(page)).toBe('light');
});
