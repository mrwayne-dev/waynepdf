import { test, expect } from '@playwright/test';

/**
 * The offline/privacy claim is the product's differentiator, so it gets a test
 * rather than a promise. Phase 1 removed the GitHub star iframe, which was the
 * only third-party request the app made; this locks that door.
 */

test('page load makes no request to ghbtns.com', async ({ page }) => {
  const blocked = [];

  // Abort rather than fulfill: if anything ever re-adds the iframe, the request
  // is recorded here AND fails loudly in the browser.
  await page.route('**/ghbtns.com/**', (route) => {
    blocked.push(route.request().url());
    return route.abort();
  });

  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect(page.locator('#suspense-loading')).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.locator('.preview')).toBeVisible();

  expect(blocked).toEqual([]);
});

test('page load makes no cross-origin requests at all', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL).origin;
  const external = new Set();

  page.on('request', (req) => {
    const url = req.url();
    // data:/blob: are in-document, not network egress.
    if (/^(data|blob):/.test(url)) return;
    if (!url.startsWith(origin)) external.add(url);
  });

  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect(page.locator('#suspense-loading')).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.locator('.preview')).toBeVisible();

  expect([...external]).toEqual([]);
});
