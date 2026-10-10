import { test, expect } from '@playwright/test';
import { boot, setText, themeSettings } from '../_helpers.js';
import { pageBox } from './_pageBox.js';

const LAYOUT = JSON.stringify({
  previewMode: 'paged',
  pageSize: 'a4',
  customWidth: 210,
  customHeight: 297,
  orientation: 'portrait',
  marginPreset: 'normal',
  marginTop: 25,
  marginRight: 25,
  marginBottom: 25,
  marginLeft: 25,
  headerLeft: '',
  headerCenter: '',
  headerRight: '{title}',
  footerLeft: '',
  footerCenter: '{page} / {pages}',
  footerRight: '',
  cover: { enabled: false, title: '', subtitle: '', author: '', date: '' },
  watermark: { text: '', opacity: 0.08, showInPreview: false },
  toc: { enabled: false, depth: 2 },
});

const body = `\n# Section One\n\n${'Lorem ipsum dolor sit amet. '.repeat(60)}\n\n# Section Two\n\n${'Sed do eiusmod tempor. '.repeat(60)}\n`;

async function paginated(page) {
  await expect(page.locator('.pagedjs_page').first()).toBeVisible({
    timeout: 60_000,
  });
  await page.waitForFunction(
    () =>
      document.querySelector('.wp-lazyload') === null &&
      document.querySelector('.paginator-status') === null,
    { timeout: 60_000 },
  );
}

test('frontmatter page size and toc re-paginate the document', async ({
  page,
}) => {
  await boot(page, { theme: themeSettings(), layout: LAYOUT });
  await setText(page, body);
  await paginated(page);

  /*
   * Measured in page units, not screen units. The preview scales each sheet to
   * fit the pane, and a smaller page earns a *larger* scale factor — so on
   * screen A5 can come out wider than A4 while being narrower on paper, which
   * is what this test is actually about.
   */
  const a4Width = (await pageBox(page)).width;

  await setText(page, `---\npageSize: a5\ntoc: true\n---\n${body}`);
  await paginated(page);

  // A5 is narrower than A4, so the sheet must shrink.
  await expect
    .poll(async () => (await pageBox(page)).width, { timeout: 60_000 })
    .toBeLessThan(a4Width);
  await expect(page.locator('.wp-toc')).toHaveCount(1);
  await expect(page.locator('.wp-toc a').first()).toBeVisible();
});

test('frontmatter cover fields produce a cover page', async ({ page }) => {
  await boot(page, { theme: themeSettings(), layout: LAYOUT });
  await setText(
    page,
    `---\ntitle: Frontmatter Cover\nauthor: M. Mgbah\n---\n${body}`,
  );
  await paginated(page);

  await expect(page.locator('.wp-cover-page')).toHaveCount(1);
  await expect(page.locator('.wp-cover-title')).toHaveText('Frontmatter Cover');
  await expect(page.locator('.wp-cover-author')).toHaveText('M. Mgbah');
});

test('removing frontmatter reverts the layout and re-paginates', async ({
  page,
}) => {
  await boot(page, { theme: themeSettings(), layout: LAYOUT });
  await setText(page, `---\ntitle: Temporary Cover\n---\n${body}`);
  await paginated(page);
  await expect(page.locator('.wp-cover-page')).toHaveCount(1);

  await setText(page, body);
  await paginated(page);
  await expect(page.locator('.wp-cover-page')).toHaveCount(0);
});
