import { test, expect } from '@playwright/test';

/**
 * Covers the two interactive paths that have no unit-test coverage upstream:
 * loading a document (upload / drag-and-drop) and triggering the print dialog.
 *
 * The drop case is a REGRESSION TEST. Under React 18 StrictMode,
 * react-codemirror2 v8 leaves two connected .CodeMirror nodes and only the last
 * is wired to onChange, so uploadFile's original querySelector('.CodeMirror')
 * wrote to a dead instance and both upload paths silently did nothing.
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

test('dropping a .md file loads it into the editor and preview', async ({
  page,
}) => {
  await boot(page);

  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(
      new File(['# Dropped Doc\n\nfrom a drop'], 'dropped.md', {
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
  });

  await expect(page.locator('.preview h1')).toHaveText('Dropped Doc', {
    timeout: 15_000,
  });
  await expect(page.locator('.preview')).toContainText('from a drop');
});

test('a non-.md file is ignored', async ({ page }) => {
  await boot(page);
  const before = await page.locator('.preview h1').textContent();

  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['nope'], 'notes.txt', { type: 'text/plain' }));
    document.querySelector('.CodeMirror').dispatchEvent(
      new DragEvent('drop', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true,
      }),
    );
  });

  await page.waitForTimeout(750);
  await expect(page.locator('.preview h1')).toHaveText(before);
});

test('the file picker loads a .md file', async ({ page }) => {
  await boot(page);

  await page.setInputFiles('#mdFile', {
    name: 'picked.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Picked Doc\n\nvia the picker'),
  });

  await expect(page.locator('.preview h1')).toHaveText('Picked Doc', {
    timeout: 15_000,
  });
  await expect(page.locator('.preview')).toContainText('via the picker');
});

test('Transform triggers the print dialog', async ({ page }) => {
  await boot(page);

  // window.print() would block on a real dialog; stub it and record the call.
  await page.evaluate(() => {
    window.__printed = 0;
    window.print = () => {
      window.__printed++;
    };
  });

  await page.locator('p.button.download').click();
  expect(await page.evaluate(() => window.__printed)).toBe(1);
});

test('Transform names the PDF after the first h1', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__waynepdf_setText('# My Resume\n\nbody'));
  await expect(page.locator('.preview h1')).toHaveText('My Resume');

  const titleAtPrint = await page.evaluate(() => {
    let seen = null;
    window.print = () => {
      seen = document.title;
    };
    document.querySelector('p.button.download').click();
    return seen;
  });

  expect(titleAtPrint).toBe('My Resume');
});
