import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures');

/**
 * page.pdf() is Chromium-only and drives the same Skia/PDF engine that
 * window.print() reaches in the real app, so this exercises the actual output
 * path without a human in the print dialog.
 *
 * We deliberately do NOT compare bytes: PDF output embeds timestamps and
 * document IDs, so it is not reproducible. The contract under test is that
 * generation completes and produces a structurally valid PDF.
 */
async function loadFixture(page, fixture) {
  const markdown = fs.readFileSync(path.join(FIXTURE_DIR, fixture), 'utf8');
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect(page.locator('#suspense-loading')).toHaveCount(0, {
    timeout: 30_000,
  });
  await page.evaluate((md) => window.__waynepdf_setText(md), markdown);
  await expect(page.locator('.preview')).toBeVisible();
}

test.describe('print-to-PDF smoke', () => {
  test('generates a structurally valid PDF from a basic document', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'page.pdf() is Chromium-only');

    await loadFixture(page, 'basic.md');

    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    expect(buffer.length).toBeGreaterThan(1000);
    // PDF magic number
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // Every valid PDF terminates with an EOF marker.
    expect(buffer.subarray(-1024).toString('latin1')).toContain('%%EOF');
  });

  test('generates a PDF for the CJK fixture', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'page.pdf() is Chromium-only');

    await loadFixture(page, 'cjk.md');
    const buffer = await page.pdf({ format: 'A4', printBackground: true });

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  test('generates a PDF for the large fixture without erroring', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'page.pdf() is Chromium-only');
    test.setTimeout(120_000);

    await loadFixture(page, 'large.md');
    const buffer = await page.pdf({ format: 'A4', printBackground: true });

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(10_000);
  });

  test('the print stylesheet hides editor chrome', async ({ page }) => {
    await loadFixture(page, 'basic.md');

    // .no-print elements must collapse under print emulation.
    await page.emulateMedia({ media: 'print' });
    const header = page.locator('header.no-print');
    await expect(header).toBeHidden();
    await expect(page.locator('.preview')).toBeVisible();

    await page.emulateMedia({ media: 'screen' });
    await expect(header).toBeVisible();
  });
});
