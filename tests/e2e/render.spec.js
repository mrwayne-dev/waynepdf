import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures');

const fixtures = fs
  .readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort();

/**
 * Boots the app, pushes fixture markdown straight into the text container via
 * the dev/test-only window.__waynepdf_setText hook, and snapshots the rendered
 * HTML. Bypassing CodeMirror keeps the snapshot about the PARSER, which is the
 * thing Phase 0 replaced.
 */
async function renderFixture(page, markdown) {
  await page.goto('/');

  // The hook is installed in an effect, so wait for it rather than racing it.
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );

  // Preview is lazy-loaded; wait for the Suspense fallback to clear.
  await expect(page.locator('#suspense-loading')).toHaveCount(0, {
    timeout: 30_000,
  });

  await page.evaluate((md) => window.__waynepdf_setText(md), markdown);
  await expect(page.locator('.preview')).toBeVisible();
}

test.describe('fixture rendering', () => {
  for (const fixture of fixtures) {
    test(`renders ${fixture}`, async ({ page }) => {
      const markdown = fs.readFileSync(path.join(FIXTURE_DIR, fixture), 'utf8');
      await renderFixture(page, markdown);

      // Settle: assert on a marker unique to this fixture before snapshotting.
      const firstHeading = markdown.match(/^#\s+(.+)$/m);
      if (firstHeading) {
        await expect(page.locator('.preview h1').first()).toHaveText(
          firstHeading[1].trim(),
          { timeout: 30_000 },
        );
      }

      const html = await page.locator('.preview').innerHTML();
      expect(html.length).toBeGreaterThan(0);
      expect(html).toMatchSnapshot(`${fixture}.html`);
    });
  }
});

test.describe('theming does not change the DOM, only the paint', () => {
  const THEMES = ['light', 'dark', 'sepia', 'high-contrast', 'print-optimized'];

  /** Boots with a theme already stored, so first paint is the theme under test. */
  async function bootWithTheme(page, theme, markdown) {
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
    await renderFixture(page, markdown);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe(theme);
  }

  const paintOf = (page) =>
    page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('.markdown-body'));
      return { background: s.backgroundColor, color: s.color };
    });

  // Latin, both Han scripts, kana, Hangul and both RTL scripts. If theming
  // ever starts depending on document content, one of these catches it.
  const CROSS_THEME_FIXTURES = [
    'basic.md',
    'cjk-tc.md',
    'cjk-sc.md',
    'cjk-ja.md',
    'cjk-ko.md',
    'rtl-arabic.md',
    'rtl-hebrew.md',
    'mixed-directional.md',
    'math.md',
  ];

  for (const fixture of CROSS_THEME_FIXTURES) {
    test(`${fixture} renders byte-identical HTML across all five themes`, async ({
      page,
    }) => {
      const markdown = fs.readFileSync(path.join(FIXTURE_DIR, fixture), 'utf8');
      const html = {};
      for (const theme of THEMES) {
        await bootWithTheme(page, theme, markdown);
        html[theme] = await page.locator('.preview').innerHTML();
      }
      // Themes are CSS-only. If a theme ever starts injecting markup — or if
      // lang/dir ever became theme-dependent — this fails.
      for (const theme of THEMES.slice(1)) {
        expect(html[theme], `${theme} vs light`).toBe(html.light);
      }
    });
  }

  test('Light, Dark and Sepia paint the document differently', async ({
    page,
  }) => {
    const markdown = fs.readFileSync(
      path.join(FIXTURE_DIR, 'basic.md'),
      'utf8',
    );
    const paint = {};
    for (const theme of ['light', 'dark', 'sepia']) {
      await bootWithTheme(page, theme, markdown);
      paint[theme] = await paintOf(page);
    }

    const backgrounds = Object.values(paint).map((p) => p.background);
    const colors = Object.values(paint).map((p) => p.color);
    expect(new Set(backgrounds).size, `backgrounds: ${backgrounds}`).toBe(3);
    expect(new Set(colors).size, `colors: ${colors}`).toBe(3);

    // Sanity-check the direction, not just the difference: dark must be darker.
    const luma = (rgb) => {
      const [r, g, b] = rgb.match(/\d+/g).map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(luma(paint.dark.background)).toBeLessThan(
      luma(paint.light.background),
    );
    expect(luma(paint.dark.color)).toBeGreaterThan(luma(paint.light.color));
  });
});

test.describe('baseline bugs are still present in the browser', () => {
  test('BOM-prefixed heading does not become an h1 (Phase 3)', async ({
    page,
  }) => {
    await renderFixture(page, '﻿# Heading after BOM\n\nBody text.');
    const html = await page.locator('.preview').innerHTML();
    expect(html).not.toContain('<h1>');
    expect(html).toContain('#');
  });

  test('$ math renders, \\( stays literal (Phase 4)', async ({ page }) => {
    await renderFixture(
      page,
      'Inline $e^{i\\pi}+1=0$ and \\(a^2+b^2=c^2\\) here.',
    );
    const html = await page.locator('.preview').innerHTML();
    // Flipped in Phase 4: the $ form now renders.
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('$e^{i\\pi}+1=0$');
    // Still literal, by design — see the note in tests/unit/parser.test.js.
    expect(html).toContain('(a^2+b^2=c^2)');
  });
});
