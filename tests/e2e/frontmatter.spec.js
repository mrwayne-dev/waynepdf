import { test, expect } from '@playwright/test';
import {
  boot,
  loadFixture,
  setText,
  readFixture,
  themeSettings,
} from './_helpers.js';

const themeAttr = (page) =>
  page.evaluate(() => document.documentElement.dataset.theme);
const layoutCSS = (page) =>
  page.evaluate(
    () => document.getElementById('wp-layout-styles')?.textContent ?? '',
  );

test.describe('recognized keys drive app state', () => {
  test('theme is overridden for the document', async ({ page }) => {
    await boot(page, { theme: themeSettings({ theme: 'light' }) });
    expect(await themeAttr(page)).toBe('light');

    await loadFixture(page, 'frontmatter.md');
    // frontmatter.md asks for sepia.
    await expect.poll(() => themeAttr(page)).toBe('sepia');
  });

  test('page size, toc and watermark reach the layout stylesheet', async ({
    page,
  }) => {
    await boot(page, { theme: themeSettings() });
    await loadFixture(page, 'frontmatter.md');

    await expect.poll(() => layoutCSS(page)).toContain('size: A5 portrait');
    const css = await layoutCSS(page);
    expect(css).toContain('target-counter');
    expect(css).toContain('content: "SPECIMEN"');
  });

  test('title and author enable and populate the cover', async ({ page }) => {
    await boot(page, { theme: themeSettings() });
    await loadFixture(page, 'frontmatter.md');
    // Cover fields are inert unless the cover is on, so they imply it.
    await expect.poll(() => layoutCSS(page)).toContain('@page cover');
  });

  test('the YAML block never appears in the rendered output', async ({
    page,
  }) => {
    await boot(page, { theme: themeSettings() });
    await loadFixture(page, 'frontmatter.md');
    const text = await page.locator('.preview').innerText();
    expect(text).not.toContain('pageSize');
    expect(text).not.toContain('watermark');
    expect(text).toContain('The block above configures this document');
  });
});

test.describe('overrides are per-document and never persist', () => {
  test('removing the block reverts to the user setting', async ({ page }) => {
    await boot(page, { theme: themeSettings({ theme: 'light' }) });
    await loadFixture(page, 'frontmatter.md');
    await expect.poll(() => themeAttr(page)).toBe('sepia');

    await setText(page, '# No frontmatter here\n\nJust a document.\n');
    await expect.poll(() => themeAttr(page)).toBe('light');
  });

  test('an override is not written to localStorage', async ({ page }) => {
    await boot(page, { theme: themeSettings({ theme: 'light' }) });
    await loadFixture(page, 'frontmatter.md');
    await expect.poll(() => themeAttr(page)).toBe('sepia');

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('waynepdf.settings.v1')),
    );
    // The document asked for sepia; the user's own preference is untouched.
    expect(stored.theme).toBe('light');
  });

  test('switching between documents swaps overrides cleanly', async ({
    page,
  }) => {
    await boot(page, { theme: themeSettings({ theme: 'light' }) });
    await setText(page, '---\ntheme: dark\n---\n\n# One\n');
    await expect.poll(() => themeAttr(page)).toBe('dark');

    await setText(page, '---\ntheme: high-contrast\n---\n\n# Two\n');
    await expect.poll(() => themeAttr(page)).toBe('high-contrast');

    await setText(page, '# Three\n');
    await expect.poll(() => themeAttr(page)).toBe('light');
  });

  test('an unrecognised key is ignored without complaint', async ({ page }) => {
    await boot(page, { theme: themeSettings({ theme: 'light' }) });
    await setText(page, '---\nnonsense: yes\ntheme: neon\n---\n\n# Body\n');
    await page.waitForTimeout(600);
    // Invalid theme rejected, document still renders.
    expect(await themeAttr(page)).toBe('light');
    await expect(page.locator('.preview h1')).toHaveText('Body');
  });
});

test.describe('malformed frontmatter', () => {
  test('toasts the parse error and renders the document as written', async ({
    page,
  }) => {
    await boot(page, { theme: themeSettings({ theme: 'light' }) });
    await loadFixture(page, 'frontmatter-malformed.md');

    await expect(page.locator('.wp-toast')).toContainText(
      'Frontmatter parse error',
      { timeout: 10_000 },
    );
    // Nothing applied, and the block stays visible so it can be fixed.
    expect(await themeAttr(page)).toBe('light');
    await expect(page.locator('.preview')).toContainText('Still Renders');
  });

  test('does not re-toast the same error on every keystroke', async ({
    page,
  }) => {
    await boot(page, { theme: themeSettings() });
    const src = readFixture('frontmatter-malformed.md');
    await setText(page, src);
    await expect(page.locator('.wp-toast')).toBeVisible({ timeout: 10_000 });
    // Toasts auto-dismiss after 1.5s; a re-toast on an unchanged error would
    // keep it permanently on screen.
    await setText(page, `${src}\nmore body\n`);
    await expect(page.locator('.wp-toast')).toHaveCount(0, { timeout: 6_000 });
  });
});
