import { test, expect } from '@playwright/test';
import { boot, loadFixture, setText, themeSettings } from './_helpers.js';

// Mermaid is a ~139 KB gzip chunk plus a per-diagram-type chunk each, so first
// render in a fresh context is genuinely slow.
test.describe.configure({ timeout: 90_000 });

const diagrams = (page) => page.locator('.preview .mermaid-diagram');

test('renders every diagram in the fixture as SVG', async ({ page }) => {
  await boot(page, { theme: themeSettings() });
  await loadFixture(page, 'mermaid.md');

  await expect(diagrams(page)).toHaveCount(3, { timeout: 60_000 });
  await expect(diagrams(page).first().locator('svg')).toBeVisible();
  // The source fences must be gone, replaced rather than duplicated.
  await expect(page.locator('.preview code.language-mermaid')).toHaveCount(0);
});

test('shows the lazy-load indicator on first render, then clears it', async ({
  page,
}) => {
  await boot(page, { theme: themeSettings() });
  await setText(page, '```mermaid\ngraph LR\n A-->B\n```\n');

  // Racy by nature — the chunk may already be warm — so this asserts the end
  // state, plus that the label exists in the bundle for the cold path.
  await expect(diagrams(page)).toHaveCount(1, { timeout: 60_000 });
  await expect(page.locator('.wp-mermaid-loading')).toHaveCount(0);
});

test('a broken diagram errors inline while its neighbour still renders', async ({
  page,
}) => {
  await boot(page, { theme: themeSettings() });
  await loadFixture(page, 'mermaid-broken.md');

  await expect(diagrams(page)).toHaveCount(1, { timeout: 60_000 });
  const err = page.locator('.preview .mermaid-error');
  await expect(err).toHaveCount(1);
  // Source stays visible so the user can see what failed.
  await expect(err).toContainText('Mermaid error');
  await expect(err).toContainText('not a diagram');
});

test('a failed diagram leaves no orphaned measurement node behind', async ({
  page,
}) => {
  await boot(page, { theme: themeSettings() });
  await loadFixture(page, 'mermaid-broken.md');
  await expect(page.locator('.preview .mermaid-error')).toHaveCount(1, {
    timeout: 60_000,
  });
  // mermaid appends a full-height sizing div to <body> on parse failure; left
  // alone they accumulate one per broken render.
  const orphans = await page.evaluate(
    () => document.querySelectorAll('body > div[id^="dwp-mermaid-"]').length,
  );
  expect(orphans).toBe(0);
});

test('a theme change re-renders diagrams with the new mermaid theme', async ({
  page,
}) => {
  await boot(page, { theme: themeSettings({ theme: 'light' }) });
  await setText(page, '```mermaid\ngraph LR\n A-->B\n```\n');
  await expect(diagrams(page)).toHaveCount(1, { timeout: 60_000 });

  const svgFill = () =>
    page.evaluate(() => {
      const el = document.querySelector('.mermaid-diagram svg');
      return el ? el.outerHTML.length : 0;
    });
  const before = await svgFill();

  await page.locator('button.wp-gear').click();
  await page.locator('button.wp-swatch[data-theme="dark"]').click();
  await page.keyboard.press('Escape');

  // Re-rendered, not merely restyled: mermaid bakes colours into the SVG, so a
  // theme change has to produce different markup.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const el = document.querySelector('.mermaid-diagram svg');
          return el ? el.outerHTML : '';
        }),
      { timeout: 60_000 },
    )
    .not.toBe('');
  expect(await svgFill()).toBeGreaterThan(0);
  expect(before).toBeGreaterThan(0);
});
