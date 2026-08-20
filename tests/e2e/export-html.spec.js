import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { boot, setText } from './_helpers.js';

/*
 * Self-contained HTML export.
 *
 * Every assertion loads the produced file from a file:// URL in a browser that
 * has never seen the app. "It looks right in the preview" proves nothing about
 * an exported file; what must hold is that it renders with no access to
 * anything outside itself.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = fs.readFileSync(
  path.resolve(__dirname, '../fixtures/export-full.md'),
  'utf8',
);

const THEME_KEY = 'waynepdf.settings.v1';
const CUSTOM_KEY = 'waynepdf.customThemes.v1';

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

const OCEAN = {
  id: '11111111-2222-3333-4444-555555555555',
  name: 'Ocean',
  basedOn: 'dark',
  overrides: { '--wp-color-canvas': '#001b2e', '--wp-color-accent': '#38bdf8' },
  createdAt: 1,
  updatedAt: 1,
};

/** Exports the fixture as HTML and returns the file's path and text. */
async function exportFixture(page, { theme, customThemes } = {}) {
  if (theme || customThemes) {
    await page.addInitScript(
      ([tk, tv, ck, cv]) => {
        if (tv) window.localStorage.setItem(tk, tv);
        if (cv) window.localStorage.setItem(ck, cv);
      },
      [
        THEME_KEY,
        theme ? themeSettings(theme) : null,
        CUSTOM_KEY,
        customThemes ? JSON.stringify(customThemes) : null,
      ],
    );
  }
  await boot(page);
  await setText(page, FIXTURE);
  // Diagrams must have finished in the preview before the export runs, or the
  // mermaid chunk fetch lands inside the export and slows the first run.
  await expect(page.locator('.mermaid-diagram')).toHaveCount(1, {
    timeout: 30_000,
  });

  await page.locator('.wp-export-caret').click();
  await page.locator('.wp-export-item[data-format="html"]').click();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.locator('.wp-export-main').click(),
  ]);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-export-'));
  const file = path.join(dir, download.suggestedFilename());
  await download.saveAs(file);
  return { file, dir, html: fs.readFileSync(file, 'utf8') };
}

/** Opens a saved file in a fresh browser, recording every request it makes. */
async function openStandalone(file) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = [];
  const failures = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('requestfailed', (r) => failures.push(r.url()));
  /*
   * pathToFileURL, not a template string: a title with a space produces a
   * filename with a space, which the browser reports percent-encoded. Comparing
   * against the raw path fails on nothing more interesting than "%20".
   */
  const url = pathToFileURL(file).href;
  await page.goto(url);
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  return { browser, page, requests, failures, url };
}

test('the exported file requests nothing but itself', async ({ page }) => {
  /*
   * THE invariant, and the second attempt at stating it.
   *
   * The first version asserted "no request whose URL is not file://", which
   * passes on a file that inlines nothing: the app's font URLs are relative, so
   * from file:///tmp/doc.html they resolve to file:///assets/... — still
   * file://, just pointing at nothing. Verified by sabotaging the inliner and
   * watching this test go green.
   *
   * What actually holds for a self-contained file is that the only thing it
   * fetches is itself, and that nothing it asks for fails.
   */
  const { file, dir } = await exportFixture(page);
  const { browser, requests, failures, url } = await openStandalone(file);
  try {
    const extra = requests.filter((r) => r !== url);
    expect(extra, `unexpected requests: ${extra.join(', ')}`).toEqual([]);
    expect(failures, `failed requests: ${failures.join(', ')}`).toEqual([]);
    expect(requests).toEqual([url]);
  } finally {
    await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the exported file carries no external references in its source', async ({
  page,
}) => {
  const { html, dir } = await exportFixture(page);
  try {
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<script\b/i);
    // Every font url() must be a data URI; one http(s) src means inlining missed.
    const fontUrls = [...html.matchAll(/url\(\s*["']?(https?:[^)"']+)/g)];
    expect(fontUrls.map((m) => m[1])).toEqual([]);
    expect(html).toContain('@font-face');
    expect(html).toContain('data:font/woff2;base64,');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('every rendered feature survives into the standalone file', async ({
  page,
}) => {
  const { file, dir } = await exportFixture(page);
  const { browser, page: standalone } = await openStandalone(file);
  try {
    // Math, rendered — not the source LaTeX.
    await expect(standalone.locator('.katex')).not.toHaveCount(0);
    await expect(standalone.locator('.katex-display')).not.toHaveCount(0);
    // Chemistry goes through the same path; an unknown command renders red.
    await expect(standalone.locator('.katex-error')).toHaveCount(0);

    // Diagram, as SVG rather than a code block.
    await expect(standalone.locator('.mermaid-diagram svg')).toHaveCount(1);
    await expect(standalone.locator('code.language-mermaid')).toHaveCount(0);

    // Callouts, task list, highlighted code, table.
    await expect(standalone.locator('.callout')).toHaveCount(2);
    await expect(standalone.locator('.callout-note')).toHaveCount(1);
    await expect(standalone.locator('.callout-warning')).toHaveCount(1);
    await expect(
      standalone.locator('input.task-list-item-checkbox'),
    ).toHaveCount(2);
    await expect(standalone.locator('pre code.hljs')).not.toHaveCount(0);
    await expect(standalone.locator('table th')).not.toHaveCount(0);
  } finally {
    await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the frontmatter block is stripped, not printed as body text', async ({
  page,
}) => {
  /*
   * Regression: the exporter called md.render directly instead of
   * renderDocument, so every exported file opened with
   * "title: … author: … date: …" across the top — the raw YAML rendered as a
   * paragraph. The preview never showed this because it uses renderDocument.
   */
  const { file, dir, html } = await exportFixture(page);
  const { browser, page: standalone } = await openStandalone(file);
  try {
    const text = await standalone.locator('.markdown-body').innerText();
    expect(text).not.toContain('author: WaynePDF');
    expect(text).not.toContain('date: 2026-08-20');
    expect(text.trimStart().startsWith('Export Test Document')).toBe(true);
    // The <title> still carries it, which is where it belongs.
    expect(html).toContain('<title>Export Test Document</title>');
  } finally {
    await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the exported document keeps its measure rather than filling the window', async ({
  page,
}) => {
  // .markdown-body carries no padding or width of its own; on screen the
  // .preview wrapper supplies both. A standalone file has no wrapper.
  const { file, dir } = await exportFixture(page);
  const { browser, page: standalone } = await openStandalone(file);
  try {
    await standalone.setViewportSize({ width: 1600, height: 900 });
    const box = await standalone.locator('.markdown-body').boundingBox();
    expect(box.width).toBeLessThanOrEqual(800);
    expect(box.x).toBeGreaterThan(100);
  } finally {
    await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the standalone file renders in the bundled font, from a data URI', async ({
  page,
}) => {
  const { file, dir } = await exportFixture(page);
  const { browser, page: standalone } = await openStandalone(file);
  try {
    const family = await standalone.evaluate(
      () =>
        getComputedStyle(document.querySelector('.markdown-body')).fontFamily,
    );
    expect(family).toContain('Inter');

    // The font is not merely named — it resolved and loaded.
    const loaded = await standalone.evaluate(() =>
      [...document.fonts].some(
        (f) => f.family.includes('Inter') && f.status === 'loaded',
      ),
    );
    expect(loaded).toBe(true);
  } finally {
    await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

for (const theme of ['light', 'dark', 'sepia']) {
  test(`the ${theme} theme travels with the exported file`, async ({
    page,
  }) => {
    const { file, dir } = await exportFixture(page, { theme });
    const canvas = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--wp-color-canvas')
        .trim(),
    );

    const { browser, page: standalone } = await openStandalone(file);
    try {
      expect(
        await standalone.evaluate(() => document.documentElement.dataset.theme),
      ).toBe(theme);
      const bg = await standalone.evaluate(
        () =>
          getComputedStyle(document.querySelector('.markdown-body'))
            .backgroundColor,
      );
      const asHex = await standalone.evaluate((c) => {
        const el = document.createElement('div');
        el.style.color = c;
        document.body.appendChild(el);
        const rgb = getComputedStyle(el).color;
        el.remove();
        return rgb;
      }, canvas);
      expect(bg).toBe(asHex);
    } finally {
      await browser.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('a custom theme is inlined with its full merged palette', async ({
  page,
}) => {
  const { file, dir, html } = await exportFixture(page, {
    theme: `custom-${OCEAN.id}`,
    customThemes: [OCEAN],
  });
  const { browser, page: standalone, requests } = await openStandalone(file);
  try {
    expect(html).toContain(`[data-theme="custom-${OCEAN.id}"]`);
    /*
     * Full palette, not just the two overrides — a partial block would inherit
     * :root's Light fallback in the standalone file, exactly the trap 6c.1
     * documented.
     */
    expect(html).toContain('--wp-color-canvas: #001b2e;');
    expect(html).toContain('--wp-color-border: #3d444d;');

    expect(
      await standalone.evaluate(() => document.documentElement.dataset.theme),
    ).toBe(`custom-${OCEAN.id}`);
    const bg = await standalone.evaluate(
      () =>
        getComputedStyle(document.querySelector('.markdown-body'))
          .backgroundColor,
    );
    expect(bg).toBe('rgb(0, 27, 46)');
    expect(requests).toEqual([pathToFileURL(file).href]);
  } finally {
    await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the download is named after the document', async ({ page }) => {
  await boot(page);
  await setText(page, '# Quarterly Report\n\nbody');
  await page.locator('.wp-export-caret').click();
  await page.locator('.wp-export-item[data-format="html"]').click();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.locator('.wp-export-main').click(),
  ]);
  expect(download.suggestedFilename()).toBe('Quarterly Report.html');
});
