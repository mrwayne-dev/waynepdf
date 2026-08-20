import { test, expect } from '@playwright/test';
import { boot, loadFixture, themeSettings, openPreferences } from './_helpers.js';

const html = (page) => page.locator('.preview').innerHTML();

test.describe('sanitize off (the default)', () => {
  test('raw HTML passes through, matching every prior phase', async ({
    page,
  }) => {
    await boot(page, { theme: themeSettings({ sanitizeHtml: false }) });
    await loadFixture(page, 'xss.md');
    const out = await html(page);
    expect(out).toContain('<script');
    expect(out).toContain('onerror');
  });

  test('the injected script does not actually execute', async ({ page }) => {
    // dangerouslySetInnerHTML does not run <script> tags, which is why the
    // default has been safe enough to ship for six phases.
    await boot(page, { theme: themeSettings({ sanitizeHtml: false }) });
    await loadFixture(page, 'xss.md');
    expect(await page.evaluate(() => window.__xssRan)).toBeUndefined();
  });
});

test.describe('sanitize on', () => {
  test('strips scripts, handlers, javascript: URLs and iframes', async ({
    page,
  }) => {
    await boot(page, { theme: themeSettings({ sanitizeHtml: true }) });
    await loadFixture(page, 'xss.md');
    const out = await html(page);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('<iframe');
  });

  test('keeps math and callouts in the same document', async ({ page }) => {
    await boot(page, { theme: themeSettings({ sanitizeHtml: true }) });
    await loadFixture(page, 'xss.md');
    await expect(page.locator('.preview .katex')).toHaveCount(1);
    await expect(page.locator('.preview .callout-warning')).toHaveCount(1);
  });

  test('keeps math, callouts, tasks and diagrams together', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await boot(page, { theme: themeSettings({ sanitizeHtml: true }) });
    await page.evaluate(() =>
      window.__waynepdf_setText(
        '# All\n\n$a^2$\n\n:::tip\nt\n:::\n\n- [x] done\n\n```mermaid\ngraph LR\n A-->B\n```\n',
      ),
    );
    await expect(page.locator('.preview .katex')).toHaveCount(1);
    await expect(page.locator('.preview .callout-tip')).toHaveCount(1);
    await expect(
      page.locator('.preview input.task-list-item-checkbox'),
    ).toHaveCount(1);
    // Sanitising must not strip mermaid's SVG.
    await expect(page.locator('.preview .mermaid-diagram svg')).toHaveCount(1, {
      timeout: 60_000,
    });
  });

  test('the Settings toggle switches it live', async ({ page }) => {
    await boot(page, { theme: themeSettings({ sanitizeHtml: false }) });
    await loadFixture(page, 'xss.md');
    expect(await html(page)).toContain('<script');

    await openPreferences(page, 'document');
    await page
      .locator('label.wp-check', { hasText: 'Sanitize HTML output' })
      .click();
    await page.keyboard.press('Escape');

    await expect.poll(() => html(page)).not.toContain('<script');
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('waynepdf.settings.v1')),
    );
    expect(stored.sanitizeHtml).toBe(true);
  });
});
