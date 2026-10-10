import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Diagrams in the paginated output.
 *
 * markdown-it leaves a ```mermaid fence as a <pre><code class="language-mermaid">
 * code block, and until the pagination path learned to render it, that code
 * block was what paged.js fragmented — so the printed PDF showed the diagram
 * SOURCE as a listing, not the diagram. The live Flowing preview rendered
 * diagrams via MermaidRenderer, but neither the Paged preview nor either
 * print route did. These tests pin the fix: the paginated DOM, which is exactly
 * what both PDF routes print, carries rendered SVG rather than fence source.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (n) =>
  fs.readFileSync(path.resolve(__dirname, '../../fixtures', n), 'utf8');

// Mermaid is a large lazily-loaded chunk; first render in a cold context is slow.
test.describe.configure({ timeout: 90_000 });

const baseLayout = {
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
};

async function paginate(page, markdown, over = {}) {
  const layout = { ...baseLayout, ...over };
  await page.addInitScript(
    ([k, v]) => localStorage.setItem(k, v),
    ['waynepdf.layout.v1', JSON.stringify(layout)],
  );
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect(page.locator('#suspense-loading')).toHaveCount(0, {
    timeout: 30_000,
  });
  await page.evaluate((d) => window.__waynepdf_setText(d), markdown);
  await expect
    .poll(() => page.locator('.pagedjs_page').count(), { timeout: 60_000 })
    .toBeGreaterThan(0);
}

const pagedDiagrams = (page) => page.locator('.pagedjs_page .mermaid-diagram');

test('every mermaid fence renders as SVG inside the paginated pages', async ({
  page,
}) => {
  await paginate(page, read('mermaid.md'));

  await expect(pagedDiagrams(page)).toHaveCount(3, { timeout: 60_000 });
  await expect(pagedDiagrams(page).first().locator('svg')).toBeVisible();
  // The fence source must be gone, replaced rather than fragmented as a listing.
  await expect(page.locator('.pagedjs_page code.language-mermaid')).toHaveCount(
    0,
  );
});

test('a broken diagram errors inline in the pages while its neighbour renders', async ({
  page,
}) => {
  await paginate(page, read('mermaid-broken.md'));

  await expect(pagedDiagrams(page)).toHaveCount(1, { timeout: 60_000 });
  const err = page.locator('.pagedjs_page .mermaid-error');
  await expect(err).toHaveCount(1);
  await expect(err).toContainText('Mermaid error');
});
