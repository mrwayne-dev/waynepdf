import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPreferences } from '../_helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../../fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');

const LAYOUT_KEY = 'waynepdf.layout.v1';

export const baseLayout = {
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

export const layout = (over = {}) => JSON.stringify({ ...baseLayout, ...over });

export async function boot(page, layoutJson) {
  if (layoutJson) {
    await page.addInitScript(
      ([k, v]) => window.localStorage.setItem(k, v),
      [LAYOUT_KEY, layoutJson],
    );
  }
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect(page.locator('#suspense-loading')).toHaveCount(0, {
    timeout: 30_000,
  });
}

export async function loadAndPaginate(page, markdown) {
  await page.evaluate((md) => window.__waynepdf_setText(md), markdown);
  // Pagination is debounced 800ms and long documents take seconds.
  await expect(page.locator('.pagedjs_page').first()).toBeVisible({
    timeout: 60_000,
  });
  await page.waitForFunction(
    // Both states now render LazyLoad; .paginator-status is error-only, so
    // waiting on it alone would report "settled" while still paginating.
    () =>
      document.querySelector('.wp-lazyload') === null &&
      document.querySelector('.paginator-status') === null,
    { timeout: 60_000 },
  );
}

const pages = (page) => page.locator('.pagedjs_page');

test.describe('mode switching', () => {
  test('Flowing is the default and renders no pages', async ({ page }) => {
    await boot(page, layout());
    await expect(page.locator('.flowing-preview')).toBeVisible();
    await expect(pages(page)).toHaveCount(0);
  });

  test('the header toggle switches to Paged and paginates', async ({
    page,
  }) => {
    await boot(page, layout());
    await page.evaluate(
      (md) => window.__waynepdf_setText(md),
      read('paged-basic.md'),
    );
    await page.getByRole('button', { name: 'Paged', exact: true }).click();

    await expect(page.locator('.pagedjs_page').first()).toBeVisible({
      timeout: 60_000,
    });
    expect(await pages(page).count()).toBeGreaterThan(1);
    await expect(page.locator('.flowing-preview')).toHaveCount(0);
  });

  test('switching back to Flowing clears the pagination', async ({ page }) => {
    await boot(page, layout({ previewMode: 'paged' }));
    await loadAndPaginate(page, read('paged-basic.md'));
    expect(await pages(page).count()).toBeGreaterThan(1);

    await page.getByRole('button', { name: 'Flowing', exact: true }).click();
    await expect(page.locator('.flowing-preview')).toBeVisible();
    await expect(pages(page)).toHaveCount(0);
  });

  test('the mode persists across a reload', async ({ page }) => {
    // No addInitScript seed here: it re-runs on every navigation, so it would
    // reset the very value the reload is supposed to have restored.
    await boot(page);
    await page.getByRole('button', { name: 'Paged', exact: true }).click();
    await expect(page.locator('.preview-paged')).toBeVisible();

    await page.reload();
    await expect(page.locator('.preview-paged')).toBeVisible({
      timeout: 30_000,
    });
    const stored = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)),
      LAYOUT_KEY,
    );
    expect(stored.previewMode).toBe('paged');
  });
});

test.describe('page count', () => {
  test('the header badge matches the rendered page elements', async ({
    page,
  }) => {
    await boot(page, layout({ previewMode: 'paged' }));
    await loadAndPaginate(page, read('paged-basic.md'));

    const count = await pages(page).count();
    expect(count).toBeGreaterThan(1);
    await expect(page.locator('.page-count')).toHaveText(
      `${count} ${count === 1 ? 'page' : 'pages'}`,
    );
  });

  test('a longer document produces more pages', async ({ page }) => {
    await boot(page, layout({ previewMode: 'paged' }));
    await loadAndPaginate(page, read('paged-basic.md'));
    const basic = await pages(page).count();

    await loadAndPaginate(page, read('paged-long.md'));
    await expect
      .poll(() => pages(page).count(), { timeout: 60_000 })
      .toBeGreaterThan(basic);
  });
});

test.describe('layout changes re-paginate', () => {
  test('page size changes the page box dimensions', async ({ page }) => {
    await boot(page, layout({ previewMode: 'paged' }));
    await loadAndPaginate(page, read('paged-basic.md'));

    const a4 = await pages(page).first().boundingBox();
    // A4 portrait at 96dpi is about 794x1123.
    expect(Math.round(a4.width)).toBeGreaterThan(700);
    expect(Math.round(a4.height)).toBeGreaterThan(a4.width);

    await openPreferences(page, 'layout');
    await page.locator('select.wp-select-page-size').selectOption('a5');
    await page.keyboard.press('Escape');

    await expect
      .poll(
        async () => Math.round((await pages(page).first().boundingBox()).width),
        {
          timeout: 60_000,
        },
      )
      .toBeLessThan(Math.round(a4.width));
  });

  test('landscape makes pages wider than tall', async ({ page }) => {
    await boot(
      page,
      layout({ previewMode: 'paged', orientation: 'landscape' }),
    );
    await loadAndPaginate(page, read('paged-basic.md'));
    const box = await pages(page).first().boundingBox();
    expect(box.width).toBeGreaterThan(box.height);
  });

  test('wider margins shrink the printable content area', async ({ page }) => {
    /*
     * Asserted on the content box, not the page count. Page count is a poor
     * proxy here: `h1 { break-before: page }` means section count dominates,
     * so this fixture stays at 7 pages under both presets even though the
     * printable area really did change.
     */
    await boot(page, layout({ previewMode: 'paged', marginPreset: 'small' }));
    await loadAndPaginate(page, read('paged-basic.md'));

    const contentWidth = () =>
      page.evaluate(
        () =>
          document
            .querySelector('.pagedjs_page_content')
            .getBoundingClientRect().width,
      );
    const pageWidth = () =>
      page.evaluate(
        () =>
          document.querySelector('.pagedjs_page').getBoundingClientRect().width,
      );

    const smallContent = await contentWidth();
    const smallPage = await pageWidth();

    // Driven through the UI rather than a reload: addInitScript re-seeds
    // localStorage on every navigation, so a reload would silently restore the
    // old value and the assertion would pass without testing anything.
    await openPreferences(page, 'layout');
    await page.locator('select.wp-select-margins').selectOption('wide');
    await page.keyboard.press('Escape');

    await expect
      .poll(contentWidth, { timeout: 60_000 })
      .toBeLessThan(smallContent);
    // The sheet is unchanged; only the margins moved.
    expect(Math.round(await pageWidth())).toBe(Math.round(smallPage));
  });
});

test.describe('headers, footers and features', () => {
  const contentOf = (page, selector) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el, '::after').content : null;
    }, selector);

  test('the running header resolves {title} from the first H1', async ({
    page,
  }) => {
    await boot(page, layout({ previewMode: 'paged' }));
    await loadAndPaginate(page, read('paged-basic.md'));
    // Generated content lives in ::after, so textContent is always empty here.
    expect(
      await contentOf(
        page,
        '.pagedjs_margin-top-right > .pagedjs_margin-content',
      ),
    ).toBe('"Paged Basic"');
  });

  test('the running footer resolves page counters', async ({ page }) => {
    await boot(page, layout({ previewMode: 'paged' }));
    await loadAndPaginate(page, read('paged-basic.md'));
    expect(
      await contentOf(
        page,
        '.pagedjs_margin-bottom-center > .pagedjs_margin-content',
      ),
    ).toContain('counter(page)');
  });

  test('the cover page renders first and drops its margin boxes', async ({
    page,
  }) => {
    await boot(
      page,
      layout({
        previewMode: 'paged',
        cover: {
          enabled: true,
          title: 'Cover Title',
          subtitle: 'A subtitle',
          author: 'M. Mgbah',
          date: '',
        },
      }),
    );
    await loadAndPaginate(page, read('paged-basic.md'));

    await expect(page.locator('.wp-cover-title')).toHaveText('Cover Title');
    await expect(page.locator('.wp-cover-subtitle')).toHaveText('A subtitle');
    // The cover is on page 1 and @page cover suppresses its header.
    const firstHeader = await page.evaluate(() => {
      const el = document.querySelector(
        '.pagedjs_page:first-of-type .pagedjs_margin-top-right > .pagedjs_margin-content',
      );
      return el ? getComputedStyle(el, '::after').content : null;
    });
    expect(firstHeader).toBe('none');
  });

  test('the TOC lists headings and resolves page numbers', async ({ page }) => {
    await boot(
      page,
      layout({ previewMode: 'paged', toc: { enabled: true, depth: 2 } }),
    );
    await loadAndPaginate(page, read('paged-basic.md'));

    await expect(page.locator('.wp-toc')).toBeVisible();
    expect(await page.locator('.wp-toc a').count()).toBeGreaterThan(3);

    // paged.js rewrites target-counter into its own generated counter, so a
    // resolved reference looks like counter(target-counter-<uuid>). An
    // unresolved one would be `none`.
    const after = await page.evaluate(() => {
      const a = document.querySelector('.wp-toc a');
      return a ? getComputedStyle(a, '::after').content : null;
    });
    expect(after).toMatch(/counter\(target-counter-/);
  });

  test('the watermark is hidden in preview unless opted in', async ({
    page,
  }) => {
    await boot(
      page,
      layout({
        previewMode: 'paged',
        watermark: { text: 'DRAFT', opacity: 0.1, showInPreview: false },
      }),
    );
    await loadAndPaginate(page, read('paged-basic.md'));
    const shown = await page.evaluate(() => {
      const el = document.querySelector('.pagedjs_page_content');
      return el ? getComputedStyle(el, '::before').content : null;
    });
    expect(shown).toBe('none');
  });

  test('the watermark shows in preview when opted in', async ({ page }) => {
    await boot(
      page,
      layout({
        previewMode: 'paged',
        watermark: { text: 'DRAFT', opacity: 0.1, showInPreview: true },
      }),
    );
    await loadAndPaginate(page, read('paged-basic.md'));
    const shown = await page.evaluate(() => {
      const el = document.querySelector('.pagedjs_page_content');
      return el ? getComputedStyle(el, '::before').content : null;
    });
    expect(shown).toBe('"DRAFT"');
  });
});

test.describe('fragmentation', () => {
  test('a table taller than a page splits instead of overflowing', async ({
    page,
  }) => {
    await boot(page, layout({ previewMode: 'paged' }));
    await loadAndPaginate(page, read('paged-tables.md'));

    expect(await pages(page).count()).toBeGreaterThan(1);

    const stats = await page.evaluate(() => ({
      // More <table> elements than source tables means paged.js fragmented one
      // of them across a break, which is the actual contract. With
      // break-inside:avoid the oversized table would instead sit on one page
      // and spill past its box.
      tableElements: document.querySelectorAll('.pagedjs_page table').length,
      worstOverflow: Math.max(
        ...[...document.querySelectorAll('.pagedjs_page_content')].map(
          (el) => el.scrollHeight - el.clientHeight,
        ),
      ),
    }));

    // The fixture has three source tables; a split produces more elements.
    expect(stats.tableElements).toBeGreaterThan(3);
    // Sub-row rounding of a few px is normal in paged.js; content loss is not.
    expect(stats.worstOverflow).toBeLessThan(12);
  });

  test('code, math, tables and lists paginate without error', async ({
    page,
  }) => {
    await boot(page, layout({ previewMode: 'paged' }));
    await loadAndPaginate(page, read('paged-mixed.md'));
    await expect(page.locator('.paginator-status.is-error')).toHaveCount(0);
    expect(await pages(page).count()).toBeGreaterThan(1);
    // Math survived fragmentation.
    expect(await page.locator('.pagedjs_page .katex').count()).toBeGreaterThan(
      0,
    );
  });
});

test.describe('debounce', () => {
  test('rapid edits collapse into a single pagination run', async ({
    page,
  }) => {
    await boot(page, layout({ previewMode: 'paged' }));
    await loadAndPaginate(page, read('paged-basic.md'));

    // Count completed runs by watching the page container identity change.
    await page.evaluate(() => {
      window.__runs = 0;
      const target = document.querySelector('.paginator-output');
      new MutationObserver((records) => {
        for (const r of records) {
          for (const node of r.addedNodes) {
            if (node.classList?.contains('pagedjs_pages')) window.__runs += 1;
          }
        }
      }).observe(target, { childList: true });
    });

    for (const n of [1, 2, 3, 4, 5]) {
      await page.evaluate(
        (i) => window.__waynepdf_setText(`# Edit ${i}\n\nbody text ${i}\n`),
        n,
      );
      await page.waitForTimeout(80);
    }

    await expect(page.locator('.pagedjs_page').first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(2000);
    // Five edits 80ms apart sit inside one 800ms debounce window.
    expect(await page.evaluate(() => window.__runs)).toBe(1);
  });
});
