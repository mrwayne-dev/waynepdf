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

test.describe('baseline bugs are still present in the browser', () => {
  test('BOM-prefixed heading does not become an h1 (Phase 3)', async ({
    page,
  }) => {
    await renderFixture(page, '﻿# Heading after BOM\n\nBody text.');
    const html = await page.locator('.preview').innerHTML();
    expect(html).not.toContain('<h1>');
    expect(html).toContain('#');
  });

  test('math delimiters render as literal text (Phase 4)', async ({ page }) => {
    await renderFixture(
      page,
      'Inline $e^{i\\pi}+1=0$ and \\(a^2+b^2=c^2\\) here.',
    );
    const html = await page.locator('.preview').innerHTML();
    expect(html).toContain('$e^{i\\pi}+1=0$');
    expect(html).toContain('(a^2+b^2=c^2)');
    expect(html).not.toContain('<math');
    expect(html).not.toContain('katex');
  });
});
