import { test, expect } from '@playwright/test';
import { resetEverything } from './_helpers.js';

/**
 * Settings panel behaviour: open/close, theme application, live typography
 * updates, persistence across reload, and absence from printed output.
 */

const STORAGE_KEY = 'waynepdf.settings.v1';

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

const gear = (page) => page.locator('button.wp-gear');
const panel = (page) => page.locator('#wp-settings-panel');
const themeAttr = (page) =>
  page.evaluate(() => document.documentElement.dataset.theme);
const cssVar = (page, name) =>
  page.evaluate(
    (n) =>
      getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );

/**
 * Picks a body font the way a user does — by clicking the pill.
 *
 * The radio itself is visually hidden behind the label, so a direct click on the
 * input is intercepted. Clicking the label is both the real interaction and the
 * thing worth testing: if the label ever stops being wired to its input, this
 * fails.
 */
async function pickFont(page, label) {
  await page
    .locator('label.wp-pill', { hasText: new RegExp(`^${label}$`) })
    .click();
  await expect(page.getByRole('radio', { name: label })).toBeChecked();
}

test.describe('panel open/close', () => {
  test('gear opens the panel', async ({ page }) => {
    await boot(page);
    await expect(panel(page)).not.toHaveClass(/is-open/);
    await gear(page).click();
    await expect(panel(page)).toHaveClass(/is-open/);
    await expect(page.locator('.wp-panel-title')).toHaveText('Settings');
  });

  test('Esc closes the panel', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await expect(panel(page)).toHaveClass(/is-open/);
    await page.keyboard.press('Escape');
    await expect(panel(page)).not.toHaveClass(/is-open/);
  });

  test('clicking the gear again closes the panel', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await expect(panel(page)).toHaveClass(/is-open/);
    await gear(page).click();
    await expect(panel(page)).not.toHaveClass(/is-open/);
  });

  test('the close button closes the panel', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('button.wp-close').click();
    await expect(panel(page)).not.toHaveClass(/is-open/);
  });

  test('focus moves into the panel on open and back to the gear on close', async ({
    page,
  }) => {
    await boot(page);
    await gear(page).click();
    await expect(page.locator('button.wp-close')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(gear(page)).toBeFocused();
  });

  test('the closed panel is not reachable by keyboard', async ({ page }) => {
    await boot(page);
    // inert while closed, so nothing inside can take focus.
    await expect(panel(page)).toHaveAttribute('inert', '');
    await gear(page).click();
    await expect(panel(page)).not.toHaveAttribute('inert', '');
  });
});

test.describe('theme selection', () => {
  const THEMES = ['light', 'dark', 'sepia', 'high-contrast', 'print-optimized'];

  for (const theme of THEMES) {
    test(`selecting ${theme} sets data-theme`, async ({ page }) => {
      await boot(page);
      await gear(page).click();
      await page.locator(`button.wp-swatch[data-theme="${theme}"]`).click();
      await expect.poll(() => themeAttr(page)).toBe(theme);
    });
  }

  test('System resolves to dark under a dark OS preference', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await boot(page);
    await gear(page).click();
    // The System swatch is the only one without its own data-theme.
    await page.locator('button.wp-swatch[aria-label="System"]').click();
    await expect.poll(() => themeAttr(page)).toBe('dark');
  });

  test('System resolves to light under a light OS preference', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await boot(page);
    await gear(page).click();
    await page.locator('button.wp-swatch[aria-label="System"]').click();
    await expect.poll(() => themeAttr(page)).toBe('light');
  });

  test('System follows a live OS preference change', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await boot(page);
    await gear(page).click();
    await page.locator('button.wp-swatch[aria-label="System"]').click();
    await expect.poll(() => themeAttr(page)).toBe('light');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => themeAttr(page)).toBe('dark');
  });

  test('the active swatch is marked pressed', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('button.wp-swatch[data-theme="sepia"]').click();
    await expect(
      page.locator('button.wp-swatch[data-theme="sepia"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.wp-theme-name')).toHaveText('Sepia');
  });
});

test.describe('typography controls', () => {
  test('the body size slider updates --wp-font-size-base live', async ({
    page,
  }) => {
    await boot(page);
    await gear(page).click();
    expect(await cssVar(page, '--wp-font-size-base')).toBe('16px');

    await page.getByLabel('Body size').fill('22');
    await expect.poll(() => cssVar(page, '--wp-font-size-base')).toBe('22px');
  });

  test('the line height slider updates --wp-line-height-base live', async ({
    page,
  }) => {
    await boot(page);
    await gear(page).click();
    await page.getByLabel('Line height').fill('1.9');
    await expect.poll(() => cssVar(page, '--wp-line-height-base')).toBe('1.9');
  });

  test('the code size slider updates --wp-font-size-code live', async ({
    page,
  }) => {
    await boot(page);
    await gear(page).click();
    await page.getByLabel('Code size').fill('19');
    await expect.poll(() => cssVar(page, '--wp-font-size-code')).toBe('19px');
  });

  test('changing font family changes the rendered body font', async ({
    page,
  }) => {
    await boot(page);
    const bodyFont = () =>
      page.evaluate(
        () => getComputedStyle(document.querySelector('.preview')).fontFamily,
      );

    const sans = await bodyFont();
    expect(sans).toContain('Inter');

    await gear(page).click();
    await pickFont(page, 'Serif');
    await expect.poll(bodyFont).toContain('Source Serif');

    await pickFont(page, 'Mono');
    await expect.poll(bodyFont).toContain('JetBrains Mono');
  });

  test('the body size slider changes the rendered preview font size', async ({
    page,
  }) => {
    await boot(page);
    const size = () =>
      page.evaluate(
        () => getComputedStyle(document.querySelector('.preview')).fontSize,
      );
    expect(await size()).toBe('16px');
    await gear(page).click();
    await page.getByLabel('Body size').fill('24');
    await expect.poll(size).toBe('24px');
  });
});

test.describe('persistence', () => {
  test('settings survive a reload', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('button.wp-swatch[data-theme="dark"]').click();
    await page.getByLabel('Body size').fill('21');
    await pickFont(page, 'Serif');
    await expect.poll(() => themeAttr(page)).toBe('dark');

    await page.reload();
    await expect(page.locator('.preview')).toBeVisible();

    await expect.poll(() => themeAttr(page)).toBe('dark');
    expect(await cssVar(page, '--wp-font-size-base')).toBe('21px');
    const stored = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)),
      STORAGE_KEY,
    );
    expect(stored).toMatchObject({
      theme: 'dark',
      fontSize: 21,
      fontFamily: 'serif',
    });
  });

  test('exactly one WaynePDF storage key is written', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('button.wp-swatch[data-theme="sepia"]').click();
    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    // Phase 3 added a second key. Two is the expected total; the assertion is
    // still exact so a stray third key would fail.
    // Phase 5 added a third key. Still exact, so a stray fourth would fail.
    expect(keys).toEqual([
      'waynepdf.language.v1',
      'waynepdf.layout.v1',
      STORAGE_KEY,
    ]);
  });

  test('reset returns every control to its default', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('button.wp-swatch[data-theme="high-contrast"]').click();
    await page.getByLabel('Body size').fill('23');
    await page.getByLabel('Code size').fill('20');
    await expect.poll(() => cssVar(page, '--wp-font-size-base')).toBe('23px');

    // Reset now confirms and reloads, so the panel's open state does not survive
    // it — the gear has to be clicked again to read the controls back.
    await resetEverything(page);

    await expect.poll(() => cssVar(page, '--wp-font-size-base')).toBe('16px');
    expect(await cssVar(page, '--wp-font-size-code')).toBe('14px');
    expect(await cssVar(page, '--wp-line-height-base')).toBe('1.6');
    await gear(page).click();
    await expect(page.locator('.wp-theme-name')).toHaveText('System');
    await expect(page.getByLabel('Body size')).toHaveValue('16');
  });

  test('cancelling the reset confirmation changes nothing', async ({
    page,
  }) => {
    await boot(page);
    await gear(page).click();
    await page.getByLabel('Body size').fill('23');
    await expect.poll(() => cssVar(page, '--wp-font-size-base')).toBe('23px');

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Reset everything' }).click();

    // No reload, no clearing — the panel is even still open.
    await expect(panel(page)).toHaveClass(/is-open/);
    expect(await cssVar(page, '--wp-font-size-base')).toBe('23px');
    expect(
      await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY),
    ).not.toBeNull();
  });

  test('reset also clears language settings, which it used to miss', async ({
    page,
  }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('select.wp-select-language').selectOption('ja');
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem('waynepdf.language.v1')).lang,
        ),
      )
      .toBe('ja');

    await resetEverything(page);

    const lang = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('waynepdf.language.v1')),
    );
    expect(lang.lang).toBe('auto');
  });

  test('a malformed stored value falls back to defaults without breaking', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate((k) => localStorage.setItem(k, '{broken'), STORAGE_KEY);
    await page.reload();
    await expect(page.locator('.preview')).toBeVisible();
    expect(await cssVar(page, '--wp-font-size-base')).toBe('16px');
    const stored = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)),
      STORAGE_KEY,
    );
    expect(stored.fontSize).toBe(16);
  });
});

test.describe('print output', () => {
  test('the panel and gear do not appear in the printed PDF', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'page.pdf() is Chromium-only');
    await boot(page);
    await gear(page).click();
    await expect(panel(page)).toHaveClass(/is-open/);

    const buffer = await page.pdf({ format: 'A4', printBackground: true });
    const text = buffer.toString('latin1');
    // The panel is no-print, so none of its copy can reach the page.
    for (const needle of ['Settings', 'Reset everything', 'Line height']) {
      expect(text).not.toContain(needle);
    }
  });

  test('the markdown body carries print-color-adjust under print media', async ({
    page,
  }) => {
    await boot(page);
    await page.emulateMedia({ media: 'print' });
    const adjust = await page.evaluate(() => {
      const el = document.querySelector('.markdown-body');
      const s = getComputedStyle(el);
      return s.printColorAdjust || s.webkitPrintColorAdjust;
    });
    expect(adjust).toBe('exact');
    await page.emulateMedia({ media: 'screen' });
  });

  test('code block backgrounds survive print emulation', async ({ page }) => {
    await boot(page);
    await page.evaluate(() =>
      window.__waynepdf_setText('```js\nconst a = 1;\n```\n'),
    );
    await expect(page.locator('.preview pre')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    const bg = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('.preview pre'))
          .backgroundColor,
    );
    // Not transparent: the fill is still declared under print.
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    await page.emulateMedia({ media: 'screen' });
  });
});

test.describe('language section', () => {
  test('renders the language select and direction pills', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await expect(page.locator('select.wp-select-language')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Auto' })).toHaveCount(1);
    await expect(page.getByRole('radio', { name: 'LTR' })).toHaveCount(1);
    await expect(page.getByRole('radio', { name: 'RTL' })).toHaveCount(1);
  });

  test('changing the language updates the preview container', async ({
    page,
  }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('select.wp-select-language').selectOption('ko');
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.querySelector('.markdown-body').getAttribute('lang'),
        ),
      )
      .toBe('ko');
  });

  test('changing text direction updates the preview container', async ({
    page,
  }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('label.wp-pill', { hasText: /^RTL$/ }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.querySelector('.markdown-body').getAttribute('dir'),
        ),
      )
      .toBe('rtl');
  });

  test('the detected-language caption only shows while Auto is selected', async ({
    page,
  }) => {
    await boot(page);
    await gear(page).click();
    await expect(page.locator('.wp-detected-lang')).toHaveText(/^Detected: /);

    await page.locator('select.wp-select-language').selectOption('ja');
    await expect(page.locator('.wp-detected-lang')).toHaveCount(0);
  });

  test('language settings survive a reload alongside theme settings', async ({
    page,
  }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('button.wp-swatch[data-theme="sepia"]').click();
    await page.locator('select.wp-select-language').selectOption('ar');
    await page.locator('label.wp-pill', { hasText: /^LTR$/ }).click();

    await page.reload();
    await expect(page.locator('.preview')).toBeVisible();

    await expect.poll(() => themeAttr(page)).toBe('sepia');
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.querySelector('.markdown-body').getAttribute('lang'),
        ),
      )
      .toBe('ar');
    expect(
      await page.evaluate(() =>
        document.querySelector('.markdown-body').getAttribute('dir'),
      ),
    ).toBe('ltr');
  });

  test('the panel is not visible in the printed PDF, language section included', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'page.pdf() is Chromium-only');
    await boot(page);
    await gear(page).click();
    const buffer = await page.pdf({ format: 'A4', printBackground: true });
    const text = buffer.toString('latin1');
    for (const needle of ['Language', 'Text direction', 'Detected:']) {
      expect(text).not.toContain(needle);
    }
  });
});

test.describe('layout section', () => {
  const layoutCSS = (page) =>
    page.evaluate(
      () => document.getElementById('wp-layout-styles')?.textContent ?? '',
    );

  test('renders the layout controls', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await expect(page.locator('select.wp-select-page-size')).toBeVisible();
    await expect(page.locator('select.wp-select-margins')).toBeVisible();
    await expect(
      page.locator('.wp-collapsible-head', { hasText: 'Header' }),
    ).toBeVisible();
    await expect(
      page.locator('.wp-collapsible-head', { hasText: 'Cover page' }),
    ).toBeVisible();
    await expect(
      page.locator('.wp-collapsible-head', { hasText: 'Watermark' }),
    ).toBeVisible();
    await expect(
      page.locator('.wp-collapsible-head', { hasText: 'Table of contents' }),
    ).toBeVisible();
  });

  test('collapsible sections start closed and open on click', async ({
    page,
  }) => {
    await boot(page);
    await gear(page).click();
    const head = page.locator('.wp-collapsible-head', { hasText: 'Watermark' });
    await expect(head).toHaveAttribute('aria-expanded', 'false');
    await head.click();
    await expect(head).toHaveAttribute('aria-expanded', 'true');
  });

  test('page size rewrites the emitted stylesheet', async ({ page }) => {
    await boot(page);
    expect(await layoutCSS(page)).toContain('size: A4 portrait');

    await gear(page).click();
    await page.locator('select.wp-select-page-size').selectOption('legal');
    await expect.poll(() => layoutCSS(page)).toContain('size: LEGAL portrait');
  });

  test('margins rewrite the emitted stylesheet', async ({ page }) => {
    await boot(page);
    expect(await layoutCSS(page)).toContain('margin: 25mm');

    await gear(page).click();
    await page.locator('select.wp-select-margins').selectOption('small');
    await expect.poll(() => layoutCSS(page)).toContain('margin: 15mm');
  });

  test('a footer template is tokenised into the stylesheet', async ({
    page,
  }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('.wp-collapsible-head', { hasText: 'Footer' }).click();

    const center = page.locator('.wp-collapsible-body input.wp-text').nth(1);
    await center.fill('Sheet {page} of {pages}');

    await expect
      .poll(() => layoutCSS(page))
      .toContain('"Sheet " counter(page) " of " counter(pages)');
  });

  test('enabling the watermark adds its rule', async ({ page }) => {
    await boot(page);
    expect(await layoutCSS(page)).not.toContain('pagedjs_page_content::before');

    await gear(page).click();
    await page
      .locator('.wp-collapsible-head', { hasText: 'Watermark' })
      .click();
    await page
      .locator('.wp-collapsible-body input.wp-text')
      .first()
      .fill('DRAFT');

    await expect.poll(() => layoutCSS(page)).toContain('content: "DRAFT"');
  });

  test('enabling the TOC adds its rules', async ({ page }) => {
    await boot(page);
    expect(await layoutCSS(page)).not.toContain('.wp-toc');

    await gear(page).click();
    await page
      .locator('.wp-collapsible-head', { hasText: 'Table of contents' })
      .click();
    await page
      .locator('label.wp-check', { hasText: 'Generate a table of contents' })
      .click();

    await expect.poll(() => layoutCSS(page)).toContain('target-counter');
  });

  test('layout settings survive a reload', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('select.wp-select-page-size').selectOption('a5');
    await page.locator('select.wp-select-margins').selectOption('wide');

    await page.reload();
    await expect(page.locator('.preview')).toBeVisible();

    await expect.poll(() => layoutCSS(page)).toContain('size: A5 portrait');
    expect(await layoutCSS(page)).toContain('margin: 35mm');
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('waynepdf.layout.v1')),
    );
    expect(stored).toMatchObject({ pageSize: 'a5', marginPreset: 'wide' });
  });

  test('Reset returns the layout to defaults', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('select.wp-select-page-size').selectOption('a3');
    await expect.poll(() => layoutCSS(page)).toContain('size: A3');

    await resetEverything(page);
    // Layout lives in its own container, but one Reset button in one panel has
    // to mean everything in that panel — now via the registry rather than a
    // hand-written list of container resets.
    await expect.poll(() => layoutCSS(page)).toContain('size: A4 portrait');
    expect(await layoutCSS(page)).toContain('margin: 25mm');
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('waynepdf.layout.v1')),
    );
    expect(stored.previewMode).toBe('flowing');
  });
});
