import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../../fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');

const LAYOUT_KEY = 'waynepdf.layout.v1';

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
const layout = (over = {}) => JSON.stringify({ ...baseLayout, ...over });

async function boot(page, layoutJson) {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, v),
    [LAYOUT_KEY, layoutJson],
  );
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect(page.locator('#suspense-loading')).toHaveCount(0, {
    timeout: 30_000,
  });
}

/**
 * Prints via page.pdf() against the paginated DOM.
 *
 * page.pdf() cannot be driven through the app's Transform button — window.print()
 * opens a dialog Playwright will not dismiss — so the DOM is put into the same
 * state Transform produces (pagination mounted, body.wp-printing set) and then
 * snapshotted. The Transform handler's own behaviour is asserted separately.
 */
async function printPaginated(page, markdown, layoutJson) {
  await page.evaluate((md) => window.__waynepdf_setText(md), markdown);

  const stored = JSON.parse(layoutJson);
  if (stored.previewMode !== 'paged') {
    // Mirror the on-demand path: build pagination into a hidden target.
    await page.evaluate(async (l) => {
      const { md } = await import('/src/App/Components/Previewer/Preview.jsx');
      const { paginateInto } =
        await import('/src/App/Components/Previewer/Paginator.jsx');
      const target = document.createElement('div');
      target.id = 'wp-print-target';
      document.getElementById('waynepdf-app').appendChild(target);
      await paginateInto(md.render(window.__wpSource), l, target);
    }, stored);
  }

  /*
   * Existence, not visibility. On the Flowing path the pages live in
   * #wp-print-target, which is deliberately visibility:hidden on screen — it
   * only becomes visible under @media print. Asserting visibility here would be
   * asserting the app is broken.
   */
  await expect
    .poll(() => page.locator('.pagedjs_page').count(), { timeout: 60_000 })
    .toBeGreaterThan(0);
  await page.waitForFunction(
    // Both states now render LazyLoad; .paginator-status is error-only, so
    // waiting on it alone would report "settled" while still paginating.
    () =>
      document.querySelector('.wp-lazyload') === null &&
      document.querySelector('.paginator-status') === null,
    { timeout: 60_000 },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.body.classList.add('wp-printing'));
  await page.waitForTimeout(400);

  return page.pdf({ printBackground: true, preferCSSPageSize: true });
}

/** pdftotext is present on this machine; skip cleanly if it ever is not. */
/** Pages of extracted text. pdftotext emits a trailing \f, so the tail is dropped. */
function pdfPages(buffer) {
  const parts = pdfText(buffer).split('\f');
  if (parts.at(-1)?.trim() === '') parts.pop();
  return parts;
}

function pdfText(buffer) {
  const file = path.join(os.tmpdir(), `wp-${Date.now()}-${Math.random()}.pdf`);
  fs.writeFileSync(file, buffer);
  try {
    return execFileSync('pdftotext', ['-layout', file, '-'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } finally {
    fs.rmSync(file, { force: true });
  }
}

function pdfPageCount(buffer) {
  const file = path.join(os.tmpdir(), `wp-${Date.now()}-${Math.random()}.pdf`);
  fs.writeFileSync(file, buffer);
  try {
    const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
    return Number(info.match(/^Pages:\s+(\d+)$/m)?.[1] ?? 0);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

test.beforeEach(async ({ page }) => {
  // The on-demand path needs the source text; the app reads it from CodeMirror,
  // which the test hook bypasses.
  await page.addInitScript(() => {
    window.__wpSource = '';
    const orig = Object.getOwnPropertyDescriptor(window, '__waynepdf_setText');
    void orig;
  });
});

test.describe('paginated print output', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'page.pdf() is Chromium-only',
  );

  test('Paged mode prints the same page count the preview shows', async ({
    page,
  }) => {
    const l = layout({ previewMode: 'paged' });
    await boot(page, l);
    const source = read('paged-basic.md');
    await page.evaluate((s) => {
      window.__wpSource = s;
    }, source);

    const buffer = await printPaginated(page, source, l);
    const previewPages = await page.locator('.pagedjs_page').count();

    expect(pdfPageCount(buffer)).toBe(previewPages);
  });

  test('Flowing mode paginates on demand for print', async ({ page }) => {
    const l = layout();
    await boot(page, l);
    const source = read('paged-basic.md');
    await page.evaluate((s) => {
      window.__wpSource = s;
    }, source);

    const buffer = await printPaginated(page, source, l);
    // Real pagination, not one giant page.
    expect(pdfPageCount(buffer)).toBeGreaterThan(1);
    expect(pdfText(buffer)).toContain('Paged Basic');
  });

  test('the footer prints resolved page numbers', async ({ page }) => {
    const l = layout({
      previewMode: 'paged',
      footerCenter: 'Page {page} of {pages}',
    });
    await boot(page, l);
    const source = read('paged-basic.md');
    await page.evaluate((s) => {
      window.__wpSource = s;
    }, source);

    const buffer = await printPaginated(page, source, l);
    const text = pdfText(buffer);
    const total = pdfPageCount(buffer);

    // Real digits, not counter() names or placeholders.
    expect(text).toContain(`Page 1 of ${total}`);
    expect(text).toContain(`Page 2 of ${total}`);
    expect(text).not.toContain('counter(');
    expect(text).not.toContain('{page}');
  });

  test('the header prints the resolved document title', async ({ page }) => {
    const l = layout({ previewMode: 'paged', headerRight: '{title}' });
    await boot(page, l);
    const source = read('paged-basic.md');
    await page.evaluate((s) => {
      window.__wpSource = s;
    }, source);

    const text = pdfText(await printPaginated(page, source, l));
    expect(text).not.toContain('{title}');
    // Appears as running content, so more than once.
    expect(text.split('Paged Basic').length - 1).toBeGreaterThan(1);
  });

  test('the cover page prints first, without running header or footer', async ({
    page,
  }) => {
    const l = layout({
      previewMode: 'paged',
      cover: {
        enabled: true,
        title: 'Quarterly Report',
        subtitle: 'Fiscal 2026',
        author: 'M. Mgbah',
        date: '2026-08-16',
      },
    });
    await boot(page, l);
    const source = read('paged-basic.md');
    await page.evaluate((s) => {
      window.__wpSource = s;
    }, source);

    const buffer = await printPaginated(page, source, l);
    const pages = pdfPages(buffer);

    expect(pages[0]).toContain('Quarterly Report');
    expect(pages[0]).toContain('Fiscal 2026');
    expect(pages[0]).toContain('M. Mgbah');
    // @page cover suppresses the margin boxes.
    expect(pages[0]).not.toMatch(/\b1 \/ \d+/);
  });

  test('the watermark prints on the pages', async ({ page }) => {
    const l = layout({
      previewMode: 'paged',
      watermark: { text: 'DRAFT', opacity: 0.15, showInPreview: false },
    });
    await boot(page, l);
    const source = read('paged-basic.md');
    await page.evaluate((s) => {
      window.__wpSource = s;
    }, source);

    /*
     * Asserted on the print-media computed style, not on extracted PDF text.
     * The watermark is rotated -45deg, so pdftotext returns its glyphs scattered
     * across the page ("F", "A R", ...) rather than the contiguous word — the
     * text really is in the PDF, but no substring assertion can see it.
     */
    await printPaginated(page, source, l);
    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(
      () =>
        getComputedStyle(
          document.querySelector('.pagedjs_page_content'),
          '::before',
        ).content,
    );
    await page.emulateMedia({ media: 'screen' });
    const onScreen = await page.evaluate(
      () =>
        getComputedStyle(
          document.querySelector('.pagedjs_page_content'),
          '::before',
        ).content,
    );

    // Hidden on screen, present on paper — the whole point of the setting.
    expect(printed).toBe('"DRAFT"');
    expect(onScreen).toBe('none');
  });

  test('the TOC prints resolved page numbers as digits', async ({ page }) => {
    const l = layout({
      previewMode: 'paged',
      toc: { enabled: true, depth: 2 },
    });
    await boot(page, l);
    const source = read('paged-basic.md');
    await page.evaluate((s) => {
      window.__wpSource = s;
    }, source);

    const buffer = await printPaginated(page, source, l);
    const pages = pdfPages(buffer);
    const tocPage = pages.find((p) => p.includes('Contents'));

    expect(tocPage).toBeTruthy();
    expect(tocPage).toContain('Introduction');
    // A resolved reference is a bare number on the entry's line. An unresolved
    // one renders as nothing at all, so this is the assertion that matters.
    const numbered = tocPage
      .split('\n')
      .filter((line) => /\S/.test(line) && /\s\d+\s*$/.test(line));
    expect(numbered.length).toBeGreaterThan(2);
  });

  test('app chrome never reaches the PDF', async ({ page }) => {
    const l = layout({ previewMode: 'paged' });
    await boot(page, l);
    const source = read('paged-basic.md');
    await page.evaluate((s) => {
      window.__wpSource = s;
    }, source);

    // Open the settings panel so every control is mounted and would print if
    // the no-print rules were wrong.
    await page.locator('button.wp-gear').click();
    const text = pdfText(await printPaginated(page, source, l));

    /*
     * Only strings that cannot collide with document content. "Paged" and
     * "Flowing" are excluded on purpose: the fixture is titled "Paged Basic",
     * so asserting their absence would fail on the document's own heading
     * rather than on leaked chrome.
     */
    for (const chrome of [
      'WaynePDF',
      'Transform',
      'Reset everything',
      'Page size',
      'Show copy button on math',
      'Table of contents',
      'Preview mode',
      'Text direction',
    ]) {
      expect(text, `"${chrome}" leaked into the PDF`).not.toContain(chrome);
    }
  });

  test('a landscape A5 page prints wider than tall', async ({ page }) => {
    const l = layout({
      previewMode: 'paged',
      pageSize: 'a5',
      orientation: 'landscape',
    });
    await boot(page, l);
    const source = read('paged-basic.md');
    await page.evaluate((s) => {
      window.__wpSource = s;
    }, source);

    const buffer = await printPaginated(page, source, l);
    const file = path.join(os.tmpdir(), `wp-ls-${Date.now()}.pdf`);
    fs.writeFileSync(file, buffer);
    try {
      const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
      const [w, h] = info
        .match(/^Page size:\s+([\d.]+) x ([\d.]+)/m)
        .slice(1)
        .map(Number);
      expect(w).toBeGreaterThan(h);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });
});

test.describe('Transform handler', () => {
  test('Transform sets body.wp-printing and builds a print target in Flowing mode', async ({
    page,
  }) => {
    const l = layout();
    await boot(page, l);
    await page.evaluate(
      (s) => window.__waynepdf_setText(s),
      read('paged-basic.md'),
    );

    // window.print() would block on a dialog, so stub it and observe the state
    // the handler had set up by the time it was called.
    await page.evaluate(() => {
      window.__printState = null;
      window.print = () => {
        window.__printState = {
          printing: document.body.classList.contains('wp-printing'),
          target: !!document.getElementById('wp-print-target'),
          pages: document.querySelectorAll('#wp-print-target .pagedjs_page')
            .length,
          title: document.title,
        };
      };
    });

    await page.locator('p.button.download').click();

    await expect
      .poll(() => page.evaluate(() => window.__printState), { timeout: 60_000 })
      .not.toBeNull();

    const state = await page.evaluate(() => window.__printState);
    expect(state.printing).toBe(true);
    expect(state.target).toBe(true);
    expect(state.pages).toBeGreaterThan(1);
    // document.title drives Chrome's default Save-as-PDF filename.
    expect(state.title).toBe('Paged Basic');
  });

  test('Transform cleans up the print target afterwards', async ({ page }) => {
    const l = layout();
    await boot(page, l);
    await page.evaluate(
      (s) => window.__waynepdf_setText(s),
      read('paged-basic.md'),
    );
    await page.evaluate(() => {
      window.print = () => {};
    });

    await page.locator('p.button.download').click();

    /*
     * Only the settled state is asserted. With print() stubbed to a no-op,
     * afterprint fires immediately, so the window in which the target exists
     * can close before an assertion can observe it — its creation is covered by
     * the print-stub test above.
     */
    await expect(page.locator('#wp-print-target')).toHaveCount(0, {
      timeout: 60_000,
    });
    expect(
      await page.evaluate(() =>
        document.body.classList.contains('wp-printing'),
      ),
    ).toBe(false);
  });

  test('Transform in Paged mode reuses the existing pagination', async ({
    page,
  }) => {
    const l = layout({ previewMode: 'paged' });
    await boot(page, l);
    await page.evaluate(
      (s) => window.__waynepdf_setText(s),
      read('paged-basic.md'),
    );
    await expect(page.locator('.pagedjs_page').first()).toBeVisible({
      timeout: 60_000,
    });

    await page.evaluate(() => {
      window.__printState = null;
      window.print = () => {
        window.__printState = {
          target: !!document.getElementById('wp-print-target'),
          printing: document.body.classList.contains('wp-printing'),
        };
      };
    });

    await page.locator('p.button.download').click();
    await expect
      .poll(() => page.evaluate(() => window.__printState), { timeout: 30_000 })
      .not.toBeNull();

    const state = await page.evaluate(() => window.__printState);
    // No second pagination: the on-screen pages are what prints.
    expect(state.target).toBe(false);
    expect(state.printing).toBe(true);
  });
});
