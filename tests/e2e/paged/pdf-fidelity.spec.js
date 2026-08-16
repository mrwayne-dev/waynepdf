import { test, expect } from '@playwright/test';
import {
  renderPage,
  px,
  analyse,
  textBounds,
  mmToPt,
  toHex,
} from './_pdfPixels.mjs';

/*
 * What actually lands on paper.
 *
 * Every assertion here reads the produced PDF — rasterised pixels for colour,
 * pdftotext -bbox for position. Phase 6.5 found two bugs that a DOM-level check
 * could not see: paged.js insets its margins with a CSS grid that an app print
 * rule was flattening, and the page box never carried the theme colour itself,
 * so the Transform path printed themed text on an unpainted sheet.
 */

const LAYOUT_KEY = 'waynepdf.layout.v1';
const THEME_KEY = 'waynepdf.settings.v1';

const baseLayout = {
  previewMode: 'flowing',
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
};

const themeSettings = (theme) =>
  JSON.stringify({
    theme,
    fontFamily: 'sans',
    fontSize: 16,
    lineHeight: 1.6,
    codeFontSize: 14,
    mathCopyEnabled: true,
    sanitizeHtml: false,
  });

const DOC = `# Fidelity Probe

${'Body paragraph text, long enough to reach both margins and give the sampler a solid band of ink to measure. '.repeat(10)}
`;

/**
 * Boots, paginates by whichever route the layout implies, and returns the PDF.
 *
 * printBackground is deliberately FALSE: it mirrors Chrome's "Background
 * graphics" checkbox, which is off by default in the real print dialog. If the
 * theme only survives with it on, users do not have it.
 */
async function printToPdf(page, layout, theme) {
  await page.addInitScript(
    ([lk, lv, tk, tv]) => {
      localStorage.setItem(lk, lv);
      localStorage.setItem(tk, tv);
    },
    [LAYOUT_KEY, JSON.stringify(layout), THEME_KEY, themeSettings(theme)],
  );
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect(page.locator('#suspense-loading')).toHaveCount(0, {
    timeout: 30_000,
  });
  await page.evaluate((d) => {
    window.__wpSource = d;
    window.__waynepdf_setText(d);
  }, DOC);

  if (layout.previewMode !== 'paged') {
    await page.evaluate(async (l) => {
      const { md } = await import('/src/App/Components/Previewer/Preview.jsx');
      const { paginateInto } =
        await import('/src/App/Components/Previewer/Paginator.jsx');
      const target = document.createElement('div');
      target.id = 'wp-print-target';
      document.getElementById('waynepdf-app').appendChild(target);
      await paginateInto(md.render(window.__wpSource), l, target);
    }, layout);
  }

  await expect
    .poll(() => page.locator('.pagedjs_page').count(), { timeout: 60_000 })
    .toBeGreaterThan(0);
  await page.waitForFunction(
    () =>
      document.querySelector('.wp-lazyload') === null &&
      document.querySelector('.paginator-status') === null,
    { timeout: 60_000 },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.body.classList.add('wp-printing'));
  await page.waitForTimeout(300);
  return page.pdf({ printBackground: false, preferCSSPageSize: true });
}

const canvasToken = (page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--wp-color-canvas')
      .trim(),
  );

test.describe('page margins reach the paper', () => {
  for (const mode of ['paged', 'flowing']) {
    test(`${mode} mode insets body text by the configured margin`, async ({
      page,
    }) => {
      const pdf = await printToPdf(
        page,
        { ...baseLayout, previewMode: mode },
        'light',
      );
      const b = textBounds(pdf);
      const expected = mmToPt(25);

      // A4 at 72dpi, so the numbers below are in the same space as the page.
      expect(b.pageWidth).toBeCloseTo(595, 0);
      /*
       * The whole bug: this read 0 when an app-level `div { display: block }`
       * flattened paged.js's page-box grid, and the grid columns ARE the
       * margins. 2pt of slack for glyph side bearings.
       */
      expect(b.minX).toBeGreaterThanOrEqual(expected - 2);
      expect(b.maxX).toBeLessThanOrEqual(b.pageWidth - expected + 2);
    });
  }

  test('both modes produce the same left inset', async ({ browser }) => {
    const bounds = {};
    for (const mode of ['paged', 'flowing']) {
      const page = await browser.newPage();
      bounds[mode] = textBounds(
        await printToPdf(page, { ...baseLayout, previewMode: mode }, 'light'),
      );
      await page.close();
    }
    expect(bounds.paged.minX).toBeCloseTo(bounds.flowing.minX, 0);
  });

  test('a wider margin preset pushes the text further in', async ({
    browser,
  }) => {
    const insets = {};
    for (const preset of ['small', 'normal', 'wide']) {
      const page = await browser.newPage();
      insets[preset] = textBounds(
        await printToPdf(
          page,
          { ...baseLayout, marginPreset: preset },
          'light',
        ),
      ).minX;
      await page.close();
    }
    expect(insets.small).toBeCloseTo(mmToPt(15), 0);
    expect(insets.normal).toBeCloseTo(mmToPt(25), 0);
    expect(insets.wide).toBeCloseTo(mmToPt(35), 0);
    expect(insets.wide).toBeGreaterThan(insets.normal);
    expect(insets.normal).toBeGreaterThan(insets.small);
  });
});

test.describe('theme colours reach the paper', () => {
  const THEMES = ['light', 'dark', 'sepia', 'high-contrast', 'print-optimized'];

  for (const mode of ['paged', 'flowing']) {
    for (const theme of THEMES) {
      test(`${mode} / ${theme} prints the theme canvas across the whole sheet`, async ({
        page,
      }) => {
        const pdf = await printToPdf(
          page,
          { ...baseLayout, previewMode: mode },
          theme,
        );
        const canvas = await canvasToken(page);
        const img = renderPage(pdf, 60);

        /*
         * Three corners, not one. The content band always painted correctly;
         * what was unpainted on the Transform path was the margin area around
         * it, which is where the running header and footer live.
         */
        for (const [name, fx, fy] of [
          ['top-left', 0.03, 0.02],
          ['top-right', 0.97, 0.02],
          ['bottom-right', 0.97, 0.98],
        ]) {
          expect(toHex(px(img, fx, fy)), `${name} corner`).toBe(canvas);
        }
      });
    }
  }

  test('body ink is the theme foreground, not a washed-out default', async ({
    browser,
  }) => {
    for (const theme of ['dark', 'sepia']) {
      const page = await browser.newPage();
      const pdf = await printToPdf(page, baseLayout, theme);
      const fg = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--wp-color-fg')
          .trim(),
      );
      // The colour furthest from the background inside the paragraph band.
      const { ink } = analyse(renderPage(pdf, 90), 0.2, 0.3, 0.8, 0.5);
      expect(toHex(ink), `${theme} body ink`).toBe(fg);
      await page.close();
    }
  });
});
