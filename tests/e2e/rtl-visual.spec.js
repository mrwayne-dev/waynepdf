import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');

/**
 * RTL layout, asserted on computed geometry rather than on a picture.
 *
 * A screenshot of Arabic text tells a reviewer almost nothing about whether the
 * *layout* mirrored — the glyphs shape right-to-left either way, because that
 * is the font's job. What actually changed in Phase 3 is which side the
 * blockquote rail and the list markers sit on, so that is what is measured. The
 * screenshot is kept alongside for human review.
 */

async function boot(page, fixture) {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect(page.locator('#suspense-loading')).toHaveCount(0, {
    timeout: 30_000,
  });
  await page.evaluate((md) => window.__waynepdf_setText(md), read(fixture));
  await expect(page.locator('.preview h1')).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          document.querySelector('.markdown-body').getAttribute('dir'),
        ),
      { timeout: 10_000 },
    )
    .toBe('rtl');
  await page.evaluate(() => document.fonts.ready);
}

const styleOf = (page, selector, props) =>
  page.evaluate(
    ([sel, keys]) => {
      const s = getComputedStyle(document.querySelector(sel));
      return Object.fromEntries(keys.map((k) => [k, s[k]]));
    },
    [selector, props],
  );

for (const fixture of ['rtl-arabic.md', 'rtl-hebrew.md']) {
  test.describe(fixture, () => {
    test('the blockquote rail is on the right', async ({ page }) => {
      await boot(page, fixture);
      const s = await styleOf(page, '.preview blockquote', [
        'borderLeftWidth',
        'borderRightWidth',
        'paddingLeft',
        'paddingRight',
      ]);
      expect(parseFloat(s.borderRightWidth)).toBeGreaterThan(0);
      expect(parseFloat(s.borderLeftWidth)).toBe(0);
      expect(parseFloat(s.paddingRight)).toBeGreaterThan(0);
      expect(parseFloat(s.paddingLeft)).toBe(0);
    });

    test('list indentation is on the right', async ({ page }) => {
      await boot(page, fixture);
      const s = await styleOf(page, '.preview ul', [
        'paddingLeft',
        'paddingRight',
      ]);
      expect(parseFloat(s.paddingRight)).toBeGreaterThan(0);
      expect(parseFloat(s.paddingLeft)).toBe(0);
    });

    test('text is right-aligned', async ({ page }) => {
      await boot(page, fixture);
      const s = await styleOf(page, '.markdown-body', ['textAlign']);
      expect(s.textAlign).toBe('right');
    });

    test('table cells are right-aligned', async ({ page }) => {
      await boot(page, fixture);
      const s = await styleOf(page, '.preview td', ['textAlign']);
      expect(s.textAlign).toBe('right');
    });
  });
}

test.describe('code stays left-to-right inside an RTL document', () => {
  test('a fenced block keeps ltr direction and isolation', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => typeof window.__waynepdf_setText === 'function',
      { timeout: 30_000 },
    );
    await expect(page.locator('#suspense-loading')).toHaveCount(0, {
      timeout: 30_000,
    });
    await page.evaluate(() =>
      window.__waynepdf_setText(
        '# اختبار\n\nنص عربي هنا.\n\n```js\nif (a && b) { return c; }\n```\n',
      ),
    );
    await expect(page.locator('.preview pre')).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            document.querySelector('.markdown-body').getAttribute('dir'),
          ),
        { timeout: 10_000 },
      )
      .toBe('rtl');

    const s = await styleOf(page, '.preview pre', [
      'direction',
      'textAlign',
      'unicodeBidi',
    ]);
    // Without this, `if (a && b)` renders with its parenthesis on the wrong end.
    expect(s.direction).toBe('ltr');
    expect(s.textAlign).toBe('left');
    expect(s.unicodeBidi).toBe('isolate');
  });
});

test.describe('visual baselines', () => {
  for (const [fixture, name] of [
    ['rtl-arabic.md', 'rtl-arabic'],
    ['rtl-hebrew.md', 'rtl-hebrew'],
  ]) {
    test(`${name} renders`, async ({ page }) => {
      await boot(page, fixture);
      // Loose tolerance for the same reason as the theme visuals: font
      // rasterisation differs between machines. The geometry assertions above
      // are the real gate.
      await expect(page.locator('.preview')).toHaveScreenshot(`${name}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
