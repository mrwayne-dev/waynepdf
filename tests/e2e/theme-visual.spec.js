import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures');

/**
 * Per-theme screenshots of the preview pane, for humans to spot-check.
 *
 * Deliberately loose tolerance: font rasterisation and subpixel antialiasing
 * differ between machines, so a pixel-strict gate here would fail for reasons
 * that have nothing to do with theming. The HTML-identity and computed-colour
 * assertions in render.spec.js are the actual regression gates; these images
 * exist so a human can see a theme break.
 */

const THEMES = ['light', 'dark', 'sepia', 'high-contrast', 'print-optimized'];

test.describe('theme visuals', () => {
  for (const theme of THEMES) {
    test(`preview renders in ${theme}`, async ({ page }) => {
      await page.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [
          'waynepdf.settings.v1',
          JSON.stringify({
            theme,
            fontFamily: 'sans',
            fontSize: 16,
            lineHeight: 1.6,
            codeFontSize: 14,
          }),
        ],
      );

      await page.goto('/');
      await page.waitForFunction(
        () => typeof window.__waynepdf_setText === 'function',
        { timeout: 30_000 },
      );
      await expect(page.locator('#suspense-loading')).toHaveCount(0, {
        timeout: 30_000,
      });

      const markdown = fs.readFileSync(
        path.join(FIXTURE_DIR, 'basic.md'),
        'utf8',
      );
      await page.evaluate((md) => window.__waynepdf_setText(md), markdown);
      await expect(page.locator('.preview h1')).toHaveText('Basic Fixture');

      // Wait for the bundled faces so the shot is not of the fallback stack.
      await page.evaluate(() => document.fonts.ready);

      await expect(page.locator('.preview')).toHaveScreenshot(
        `theme-${theme}.png`,
        { maxDiffPixelRatio: 0.02 },
      );
    });
  }
});
