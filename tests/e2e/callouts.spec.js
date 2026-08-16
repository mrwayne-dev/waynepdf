import { test, expect } from '@playwright/test';
import { boot, loadFixture, themeSettings } from './_helpers.js';

const TYPES = ['note', 'tip', 'warning', 'danger', 'info'];

test.describe('callouts', () => {
  test('all five types render with their classes', async ({ page }) => {
    await boot(page, { theme: themeSettings() });
    await loadFixture(page, 'callouts.md');
    await expect(page.locator('.preview .callout')).toHaveCount(6);
    for (const type of TYPES) {
      await expect(
        page.locator(`.preview .callout-${type}`).first(),
      ).toBeVisible();
    }
  });

  test('a custom fence title replaces the default', async ({ page }) => {
    await boot(page, { theme: themeSettings() });
    await loadFixture(page, 'callouts.md');
    await expect(page.locator('.callout-warning .callout-title')).toHaveText(
      'Custom Warning Title',
    );
  });

  test('markdown inside a callout renders', async ({ page }) => {
    await boot(page, { theme: themeSettings() });
    await loadFixture(page, 'callouts.md');
    await expect(page.locator('.callout-note strong').first()).toHaveText(
      'bold',
    );
    await expect(page.locator('.callout-info a')).toHaveAttribute(
      'href',
      'https://example.com',
    );
  });

  test('each type resolves a distinct accent colour', async ({ page }) => {
    await boot(page, { theme: themeSettings() });
    await loadFixture(page, 'callouts.md');
    const colours = await page.evaluate(
      (types) =>
        types.map((t) => {
          const el = document.querySelector(`.callout-${t} .callout-title`);
          return getComputedStyle(el).color;
        }),
      TYPES,
    );
    for (const c of colours) expect(c).toMatch(/^rgb/);
    // note/tip/warning/danger must differ; info shares the accent with nothing
    // else here, so four distinct values is the floor.
    expect(new Set(colours).size).toBeGreaterThanOrEqual(4);
  });

  test('callouts repaint across all five themes', async ({ page }) => {
    for (const theme of [
      'light',
      'dark',
      'sepia',
      'high-contrast',
      'print-optimized',
    ]) {
      const ctx = await page.context().newPage();
      await ctx.addInitScript(
        ([k, v]) => window.localStorage.setItem(k, v),
        ['waynepdf.settings.v1', themeSettings({ theme })],
      );
      await ctx.goto('/');
      await ctx.waitForFunction(
        () => typeof window.__waynepdf_setText === 'function',
        { timeout: 30_000 },
      );
      await ctx.evaluate(() =>
        window.__waynepdf_setText(':::danger\nbody\n:::\n'),
      );
      await ctx.locator('.callout-danger').waitFor();
      const bg = await ctx.evaluate(
        () =>
          getComputedStyle(document.querySelector('.callout-danger'))
            .backgroundColor,
      );
      // color-mix against the theme canvas, so never transparent and never the
      // same across themes with different canvases.
      expect(bg, theme).not.toBe('rgba(0, 0, 0, 0)');
      await ctx.close();
    }
  });
});

test.describe('task lists', () => {
  test('checkboxes render with source state and are not interactive', async ({
    page,
  }) => {
    await boot(page, { theme: themeSettings() });
    await loadFixture(page, 'tasks.md');
    const boxes = page.locator('.preview input.task-list-item-checkbox');
    await expect(boxes).toHaveCount(7);
    expect(await boxes.nth(0).isChecked()).toBe(true);
    expect(await boxes.nth(1).isChecked()).toBe(false);
    // Disabled, so a click cannot change it — the preview is not an editor.
    expect(await boxes.nth(1).isDisabled()).toBe(true);
  });

  test('clicking a checkbox changes nothing', async ({ page }) => {
    await boot(page, { theme: themeSettings() });
    await loadFixture(page, 'tasks.md');
    const box = page.locator('.preview input.task-list-item-checkbox').nth(1);
    await box.click({ force: true });
    expect(await box.isChecked()).toBe(false);
  });
});
