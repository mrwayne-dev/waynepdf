import { test, expect } from '@playwright/test';
import { boot, openPreferences } from './_helpers.js';

/*
 * The document face and the app face are separate decisions.
 *
 * Picking Serif or Mono in preferences is a statement about the document being
 * written, not about the application. --wp-font-family-ui exists so chrome
 * cannot accidentally follow --wp-font-family-body; these tests are what keeps
 * the two from being quietly re-merged.
 */

/** Chrome, and nothing that is part of the rendered document. */
const CHROME = {
  'app shell': '#waynepdf-app',
  header: 'header',
  'mode button': 'header .mode',
  'save status': '.save-status',
  sidebar: '.wp-sidebar',
  'sidebar wordmark': '.wp-sidebar-wordmark',
  'document row label': '.wp-doc-label',
  'new document button': '.wp-sidebar-new',
  'sidebar search': '.wp-sidebar-search-input',
  'preferences window': '.wp-prefs',
  'preferences title': '.wp-prefs-title',
  'preferences search': '.wp-prefs-search-input',
  'preferences rail item': '.wp-prefs-rail-item',
  'preferences label': '.wp-prefs .wp-label',
  'preferences select': '.wp-prefs select',
  'reset button': 'button.wp-prefs-reset',
};

const firstFamily = (page, selector) =>
  page.evaluate((sel) => {
    const nodes = document.querySelectorAll(sel);
    const el = nodes[nodes.length - 1];
    if (!el) return '(absent)';
    return getComputedStyle(el).fontFamily.split(',')[0].replace(/"/g, '');
  }, selector);

const pickFont = async (page, label) => {
  await page
    .locator('label.wp-pill', { hasText: new RegExp(`^${label}$`) })
    .click();
  await expect(page.getByRole('radio', { name: label })).toBeChecked();
};

for (const family of ['Serif', 'Mono']) {
  test(`choosing ${family} as the body font leaves app chrome in Inter`, async ({
    page,
  }) => {
    await boot(page);
    await openPreferences(page, 'appearance');
    await pickFont(page, family);

    // The document really did change — otherwise this test proves nothing.
    await expect
      .poll(() => firstFamily(page, '.markdown-body'))
      .toBe(
        family === 'Serif'
          ? 'Source Serif 4 Variable'
          : 'JetBrains Mono Variable',
      );

    /*
     * Layout, because Appearance contains no <select> and a select is the one
     * chrome control that does not inherit font-family from its ancestors by
     * default — which makes it the most likely place for the UI face to leak.
     */
    await openPreferences(page, 'layout');

    for (const [name, selector] of Object.entries(CHROME)) {
      expect(
        await firstFamily(page, selector),
        `${name} should stay in the UI face`,
      ).toBe('Inter Variable');
    }
  });
}

test('the UI token is independent of the body token', async ({ page }) => {
  await boot(page);
  await openPreferences(page, 'appearance');
  await pickFont(page, 'Mono');

  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      ui: cs.getPropertyValue('--wp-font-family-ui').trim(),
      body: cs.getPropertyValue('--wp-font-family-body').trim(),
    };
  });
  expect(tokens.ui).toContain('Inter');
  expect(tokens.ui).not.toContain('JetBrains');
  expect(tokens.body).toContain('JetBrains');
});

test('nothing visible falls through to the browser default serif', async ({
  page,
}) => {
  await boot(page);
  await openPreferences(page, 'appearance');

  const offenders = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('head')) continue;
      const first = getComputedStyle(el)
        .fontFamily.split(',')[0]
        .replace(/"/g, '')
        .trim();
      if (!/^Times/i.test(first)) continue;
      // Only elements that actually render text of their own matter.
      const hasText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim(),
      );
      if (hasText && el.offsetParent !== null) {
        out.push(`${el.tagName.toLowerCase()}.${el.className}`);
      }
    }
    return out;
  });
  expect(offenders).toEqual([]);
});
