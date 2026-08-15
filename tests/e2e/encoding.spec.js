import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENCODED_DIR = path.resolve(__dirname, '../fixtures/encoded');

/**
 * File loading through the real picker, with real bytes.
 *
 * These go through setInputFiles rather than the __waynepdf_setText hook on
 * purpose: encoding detection lives in the file-reading path, so driving the
 * text setter directly would skip the entire thing under test.
 */

async function boot(page) {
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

const upload = (page, name) =>
  page.setInputFiles('#mdFile', {
    name,
    mimeType: 'text/markdown',
    buffer: fs.readFileSync(path.join(ENCODED_DIR, name)),
  });

const banner = (page) => page.locator('.wp-encoding-banner');

test.describe('BOM handling', () => {
  for (const file of ['utf8-bom.md', 'utf16le-bom.md', 'utf16be-bom.md']) {
    test(`${file} renders its first line as an h1`, async ({ page }) => {
      await boot(page);
      await upload(page, file);
      // The Phase 0 bug: the BOM made this a paragraph containing a literal #.
      await expect(page.locator('.preview h1')).toHaveText(
        'Heading after BOM',
        { timeout: 15_000 },
      );
      await expect(page.locator('.preview')).toContainText('Paragraph.');
    });
  }

  test('a UTF-8 BOM file shows no banner — UTF-8 is the expected case', async ({
    page,
  }) => {
    await boot(page);
    await upload(page, 'utf8-bom.md');
    await expect(page.locator('.preview h1')).toHaveText('Heading after BOM');
    await expect(banner(page)).toHaveCount(0);
  });

  test('UTF-16 LE reports its encoding in the banner', async ({ page }) => {
    await boot(page);
    await upload(page, 'utf16le-bom.md');
    await expect(banner(page)).toHaveText(
      /Loaded as UTF-16 LE \(auto-detected\)\./,
    );
    await expect(banner(page)).toHaveClass(/is-info/);
  });
});

test.describe('legacy encodings', () => {
  const CASES = [
    ['big5.md', 'Big5', '繁體中文', '第一項'],
    ['gbk.md', 'GB18030', '简体中文', '第一项'],
    ['shift-jis.md', 'Shift-JIS', '日本語', '一つ目'],
  ];

  for (const [file, label, heading, body] of CASES) {
    test(`${file} decodes and announces ${label}`, async ({ page }) => {
      await boot(page);
      await upload(page, file);

      await expect(page.locator('.preview h1')).toHaveText(heading, {
        timeout: 15_000,
      });
      await expect(page.locator('.preview')).toContainText(body);
      // Mojibake would show replacement characters instead.
      await expect(page.locator('.preview')).not.toContainText('�');
      await expect(banner(page)).toHaveText(
        new RegExp(`Loaded as ${label} \\(auto-detected\\)\\.`),
      );
    });
  }
});

test.describe('undetectable input', () => {
  test('malformed bytes produce a warning, not silent mojibake', async ({
    page,
  }) => {
    await boot(page);
    await upload(page, 'malformed.md');
    await expect(banner(page)).toHaveClass(/is-warning/);
    await expect(banner(page)).toHaveText(
      /encoding could not be detected; loaded as UTF-8/,
    );
  });

  test('an empty file loads without warning', async ({ page }) => {
    await boot(page);
    await page.setInputFiles('#mdFile', {
      name: 'empty.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from([]),
    });
    await expect(banner(page)).toHaveCount(0);
  });
});

test.describe('banner lifecycle', () => {
  test('dismisses on the close button', async ({ page }) => {
    await boot(page);
    await upload(page, 'big5.md');
    await expect(banner(page)).toBeVisible();
    await page.locator('.wp-encoding-banner-close').click();
    await expect(banner(page)).toHaveCount(0);
  });

  test('dismisses when the next document is loaded', async ({ page }) => {
    await boot(page);
    await upload(page, 'big5.md');
    await expect(banner(page)).toBeVisible();

    // A plain UTF-8 load has nothing to announce, so the stale notice clears.
    await page.setInputFiles('#mdFile', {
      name: 'plain.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Plain UTF-8\n', 'utf8'),
    });
    await expect(page.locator('.preview h1')).toHaveText('Plain UTF-8');
    await expect(banner(page)).toHaveCount(0);
  });

  test('is excluded from the printed PDF', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'page.pdf() is Chromium-only');
    await boot(page);
    await upload(page, 'big5.md');
    await expect(banner(page)).toBeVisible();

    const buffer = await page.pdf({ format: 'A4', printBackground: true });
    expect(buffer.toString('latin1')).not.toContain('auto-detected');
  });
});

test.describe('drag and drop uses the same path', () => {
  test('a dropped Big5 file is decoded, not read as UTF-8', async ({
    page,
  }) => {
    await boot(page);
    const bytes = Array.from(
      fs.readFileSync(path.join(ENCODED_DIR, 'big5.md')),
    );

    await page.evaluate((byteArray) => {
      const dt = new DataTransfer();
      dt.items.add(
        new File([new Uint8Array(byteArray)], 'big5.md', {
          type: 'text/markdown',
        }),
      );
      document.querySelector('.CodeMirror').dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: dt,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, bytes);

    await expect(page.locator('.preview h1')).toHaveText('繁體中文', {
      timeout: 15_000,
    });
    await expect(banner(page)).toHaveText(/Big5/);
  });
});
