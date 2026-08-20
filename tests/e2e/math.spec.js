import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPreferences } from './_helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures');
const MATH = fs.readFileSync(path.join(FIXTURE_DIR, 'math.md'), 'utf8');

const THEME_KEY = 'waynepdf.settings.v1';
const theme = (over = {}) =>
  JSON.stringify({
    theme: 'light',
    fontFamily: 'sans',
    fontSize: 16,
    lineHeight: 1.6,
    codeFontSize: 14,
    mathCopyEnabled: true,
    ...over,
  });

async function boot(page, settings) {
  if (settings) {
    await page.addInitScript(
      ([k, v]) => window.localStorage.setItem(k, v),
      [THEME_KEY, settings],
    );
  }
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect(page.locator('#suspense-loading')).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.locator('.preview')).toBeVisible();
}

async function loadMath(page) {
  await page.evaluate((src) => window.__waynepdf_setText(src), MATH);
  await expect(page.locator('.preview .katex').first()).toBeVisible({
    timeout: 15_000,
  });
  await page.evaluate(() => document.fonts.ready);
}

const katex = (page) => page.locator('.preview .katex');
const copyButton = (page) => page.locator('button.math-copy-button');

test.describe('rendering', () => {
  test('the math fixture renders KaTeX, not literal source', async ({
    page,
  }) => {
    await boot(page, theme());
    await loadMath(page);

    expect(await katex(page).count()).toBeGreaterThan(5);
    await expect(page.locator('.preview .katex-display').first()).toBeVisible();

    /*
     * Scoped to prose: the fixture deliberately contains the literal strings
     * `$e^{i\pi}$` and `'$5'` inside code samples, to prove code is left alone.
     * A document-wide "no raw source" assertion would fail on those.
     */
    const proseText = await page.evaluate(() =>
      [...document.querySelectorAll('.preview p')]
        .filter((p) => !p.querySelector('code'))
        .map((p) => p.innerText)
        .join('\n'),
    );
    expect(proseText).not.toContain('e^{i\\pi}');
    expect(proseText).not.toContain('\\int_0^1');
    // Real glyphs, not source.
    expect(proseText).toContain('π');
  });

  test('mhchem \\ce renders as chemistry, not an unknown command', async ({
    page,
  }) => {
    /*
     * Regression guard for a dual-package hazard that only exists in a real
     * bundle. KaTeX has conditional exports; importing 'katex/contrib/mhchem'
     * registers \ce on the ESM instance while the CJS plugin renders with the
     * require() instance, so \ce comes out as an unknown command tinted with
     * errorColor. Vitest collapses the two instances, so this cannot be caught
     * by a unit test — it has to run in the browser.
     */
    await boot(page, theme());
    await page.evaluate(() =>
      window.__waynepdf_setText(
        'Water $\\ce{H2O}$ and $\\ce{Fe + O2 -> Fe2O3}$.\n',
      ),
    );
    await expect(page.locator('.preview .katex').first()).toBeVisible({
      timeout: 15_000,
    });

    const preview = page.locator('.preview');
    await expect(preview).not.toContainText('\\ce');
    // errorColor is how an unrecognised command surfaces; it must be absent.
    const html = await preview.innerHTML();
    expect(html).not.toContain('--wp-color-danger');
    expect(html).not.toContain('katex-error');
    // Subscripted formula, i.e. mhchem actually parsed it.
    await expect(preview).toContainText('2');
  });

  test('a malformed equation renders as an error, not a crash', async ({
    page,
  }) => {
    await boot(page, theme());
    await loadMath(page);
    const err = page.locator('.preview .katex-error');
    await expect(err).toHaveCount(1);
    // The rest of the document still rendered.
    await expect(page.locator('.preview h1')).toHaveText('Math');
  });

  test('backslash delimiters stay literal, by design', async ({ page }) => {
    await boot(page, theme());
    await loadMath(page);
    const text = await page.locator('.preview').innerText();
    expect(text).toContain('(a^2+b^2=c^2)');
    expect(text).toContain('[E = mc^2]');
  });

  test('dollar signs inside code stay literal', async ({ page }) => {
    await boot(page, theme());
    await loadMath(page);
    const codeText = await page.locator('.preview pre').first().innerText();
    expect(codeText).toContain('$5');
    await expect(page.locator('.preview pre .katex')).toHaveCount(0);
  });

  test('every rendered equation carries its LaTeX source', async ({ page }) => {
    await boot(page, theme());
    await loadMath(page);
    const missing = await page.evaluate(
      () =>
        [...document.querySelectorAll('.preview .katex')].filter(
          (el) => !el.getAttribute('data-latex'),
        ).length,
    );
    expect(missing).toBe(0);
  });
});

test.describe('copy to clipboard', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('hovering an equation reveals the copy button', async ({ page }) => {
    await boot(page, theme());
    await loadMath(page);
    await expect(copyButton(page)).toHaveCount(0);

    await katex(page).first().hover();
    await expect(copyButton(page)).toBeVisible({ timeout: 300 });
  });

  test('clicking copy puts the LaTeX source on the clipboard', async ({
    page,
  }) => {
    await boot(page, theme());
    await loadMath(page);

    const target = katex(page).first();
    const expected = await target.getAttribute('data-latex');
    expect(expected).toBeTruthy();

    await target.hover();
    await copyButton(page).click();

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(expected);
  });

  test('a toast appears and clears within two seconds', async ({ page }) => {
    await boot(page, theme());
    await loadMath(page);
    await katex(page).first().hover();
    await copyButton(page).click();

    const toast = page.locator('.wp-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveText('LaTeX copied');
    await expect(toast).toHaveCount(0, { timeout: 2_000 });
  });

  test('the button disappears after the cursor leaves', async ({ page }) => {
    await boot(page, theme());
    await loadMath(page);
    await katex(page).first().hover();
    await expect(copyButton(page)).toBeVisible();

    await page.locator('.preview h1').hover();
    await expect(copyButton(page)).toHaveCount(0, { timeout: 2_000 });
  });

  test('the setting turns the button off', async ({ page }) => {
    await boot(page, theme({ mathCopyEnabled: false }));
    await loadMath(page);
    await katex(page).first().hover();
    await page.waitForTimeout(500);
    await expect(copyButton(page)).toHaveCount(0);
  });

  test('the Settings toggle turns it off live and persists', async ({
    page,
  }) => {
    await boot(page, theme());
    await loadMath(page);
    await katex(page).first().hover();
    await expect(copyButton(page)).toBeVisible();

    await openPreferences(page, 'document');
    await page
      .locator('label.wp-check', { hasText: 'Show copy button on math' })
      .click();
    await page.keyboard.press('Escape');

    await katex(page).first().hover();
    await page.waitForTimeout(400);
    await expect(copyButton(page)).toHaveCount(0);

    const stored = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)),
      THEME_KEY,
    );
    expect(stored.mathCopyEnabled).toBe(false);
  });
});

test.describe('theme integration', () => {
  const THEMES = ['light', 'dark', 'sepia', 'high-contrast', 'print-optimized'];

  for (const t of THEMES) {
    test(`math has a resolved colour in ${t}`, async ({ page }) => {
      await boot(page, theme({ theme: t }));
      await loadMath(page);
      const colour = await page.evaluate(
        () => getComputedStyle(document.querySelector('.preview .katex')).color,
      );
      expect(colour).toMatch(/^rgb/);
      expect(colour).not.toBe('rgba(0, 0, 0, 0)');
    });
  }

  test('Light and Dark paint math differently', async ({ page }) => {
    const read = async (t) => {
      const ctx = await page.context().newPage();
      await ctx.addInitScript(
        ([k, v]) => window.localStorage.setItem(k, v),
        [THEME_KEY, theme({ theme: t })],
      );
      await ctx.goto('/');
      await ctx.waitForFunction(
        () => typeof window.__waynepdf_setText === 'function',
        { timeout: 30_000 },
      );
      await ctx.evaluate((src) => window.__waynepdf_setText(src), MATH);
      await ctx.locator('.preview .katex').first().waitFor();
      const colour = await ctx.evaluate(
        () => getComputedStyle(document.querySelector('.preview .katex')).color,
      );
      await ctx.close();
      return colour;
    };
    expect(await read('light')).not.toBe(await read('dark'));
  });
});

test.describe('print output', () => {
  test('math reaches the PDF as glyphs, not literal dollars', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'page.pdf() is Chromium-only');
    await boot(page, theme());
    await loadMath(page);
    // Hover first so the copy button exists and must be excluded by no-print.
    await katex(page).first().hover();
    await expect(copyButton(page)).toBeVisible();

    const buffer = await page.pdf({ format: 'A4', printBackground: true });
    const raw = buffer.toString('latin1');

    expect(buffer.length).toBeGreaterThan(1000);
    expect(raw.startsWith('%PDF-')).toBe(true);
    // KaTeX fonts are embedded, which is what proves glyph rendering.
    expect(raw).toMatch(/KaTeX_(Main|Math|Size\d|AMS)/);
    // Chrome UI chrome must not be in there.
    expect(raw).not.toContain('LaTeX copied');
  });

  test('the copy button is not visible under print emulation', async ({
    page,
  }) => {
    await boot(page, theme());
    await loadMath(page);
    await katex(page).first().hover();
    await expect(copyButton(page)).toBeVisible();

    await page.emulateMedia({ media: 'print' });
    await expect(copyButton(page)).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
  });
});
