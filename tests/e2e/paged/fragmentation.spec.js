import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Fragmentation: what ends up on which page, and whether anything spills.
 *
 * The Phase 6.5 audit found a 90-line code block overflowing its page box by
 * 588px — printing over the bottom margin and off the sheet — because Phase 5's
 * blanket `break-inside: avoid` on pre is unsatisfiable for a block taller than
 * a page. These tests pin the corrected behaviour.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (n) =>
  fs.readFileSync(path.resolve(__dirname, '../../fixtures', n), 'utf8');

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

const line = (i) =>
  `const line${i} = ${i}; // filler text to make this listing taller than a page`;
const BIG_CODE = `# Big Code\n\nIntro.\n\n\`\`\`js\n${Array.from({ length: 90 }, (_, i) => line(i)).join('\n')}\n\`\`\`\n\nAfter.\n`;
const SMALL_CODE = `# Small Code\n\nIntro.\n\n\`\`\`js\n${Array.from({ length: 6 }, (_, i) => line(i)).join('\n')}\n\`\`\`\n\nAfter.\n`;

/**
 * A line box may straddle a page break by a fraction of its height; paged.js
 * breaks between lines but the surviving line's box can round past the edge.
 * Measured at 7px for tables and 9-10px for code. The guard is set just above
 * that so a real overflow — the 588px kind — still fails.
 */
const OVERFLOW_TOLERANCE_PX = 14;

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
  await page.waitForFunction(
    () => document.querySelector('.wp-lazyload') === null,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(300);
}

/** Every element that sticks out of the page's content box, and by how much. */
const overflows = (page) =>
  page.evaluate((tolerance) => {
    const out = [];
    for (const pg of document.querySelectorAll('.pagedjs_page')) {
      const content = pg.querySelector('.pagedjs_page_content');
      if (!content) continue;
      const cb = content.getBoundingClientRect();
      for (const el of content.querySelectorAll(
        'pre,table,blockquote,img,p,li',
      )) {
        const b = el.getBoundingClientRect();
        if (!b.height) continue;
        const over =
          Math.max(0, b.bottom - cb.bottom) + Math.max(0, cb.top - b.top);
        if (over > tolerance) {
          out.push(`${el.tagName.toLowerCase()} by ${Math.round(over)}px`);
        }
      }
    }
    return out;
  }, OVERFLOW_TOLERANCE_PX);

const startsOfPages = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.pagedjs_page')].map((pg) => {
      const el = pg
        .querySelector('.pagedjs_page_content')
        ?.querySelector('h1,h2,h3,p,pre,table,blockquote,ul,ol,section');
      return el ? el.tagName.toLowerCase() : '(empty)';
    }),
  );

test.describe('oversized blocks', () => {
  test('a code block taller than the page splits instead of overflowing', async ({
    page,
  }) => {
    await paginate(page, BIG_CODE);
    expect(await overflows(page)).toEqual([]);
    // It really did split, rather than being dropped or shrunk onto one page.
    const pagesWithCode = await page.locator('.pagedjs_page:has(pre)').count();
    expect(pagesWithCode).toBeGreaterThan(1);
    // And none of it vanished.
    const text = await page.locator('.pagedjs_pages').innerText();
    expect(text).toContain('const line0 =');
    expect(text).toContain('const line89 =');
  });

  test('a code block that fits is still kept whole', async ({ page }) => {
    await paginate(page, SMALL_CODE);
    expect(await overflows(page)).toEqual([]);
    expect(await page.locator('.pagedjs_page:has(pre)').count()).toBe(1);
  });

  test('a blockquote taller than the page splits cleanly', async ({ page }) => {
    const quote =
      '# Big Quote\n\n' +
      Array.from(
        { length: 70 },
        (_, i) => `> Quoted line ${i}, long enough to wrap onto the next line.`,
      ).join('\n>\n');
    await paginate(page, quote);
    expect(await overflows(page)).toEqual([]);
    expect(
      await page.locator('.pagedjs_page:has(blockquote)').count(),
    ).toBeGreaterThan(1);
  });
});

test.describe('fixtures fragment without spilling', () => {
  for (const fixture of [
    'paged-basic.md',
    'paged-long.md',
    'paged-tables.md',
    'paged-mixed.md',
  ]) {
    test(`${fixture} keeps every element inside its page box`, async ({
      page,
    }) => {
      await paginate(page, read(fixture));
      expect(await overflows(page)).toEqual([]);
    });
  }
});

test.describe('headings and cover', () => {
  test('headings flow continuously rather than each forcing a new page', async ({
    page,
  }) => {
    await paginate(page, read('paged-long.md'));
    const starts = await startsOfPages(page);
    // The document opens with its first heading, sharing page 1.
    expect(starts[0]).toBe('h1');
    // paged-long has 34 H1 sections. When each H1 forced a page break there
    // were more than 34 pages and almost every page opened on an h1 — ending
    // the previous page early with a blank band. Flowing continuously packs the
    // short sections together, so the document is far shorter than its section
    // count and most pages begin mid-flow instead of on a heading.
    expect(starts.length).toBeLessThan(34);
    expect(starts.filter((s) => s === 'h1').length).toBeLessThan(starts.length);
  });

  test('a cover page does not push a blank sheet before the first heading', async ({
    page,
  }) => {
    await paginate(page, read('paged-basic.md'), {
      cover: {
        enabled: true,
        title: 'Cover',
        subtitle: 'Sub',
        author: 'A',
        date: '2026',
      },
    });
    const starts = await startsOfPages(page);
    expect(starts[0]).toBe('section');
    // Content begins immediately on page 2, not page 3.
    expect(starts[1]).toBe('h1');
    expect(await overflows(page)).toEqual([]);
  });
});

test('a table taller than a page splits and repeats its header', async ({
  page,
}) => {
  await paginate(page, read('paged-tables.md'));
  const pagesWithTable = await page.locator('.pagedjs_page:has(table)').count();
  expect(pagesWithTable).toBeGreaterThan(1);
  // thead is display:table-header-group, so each fragment carries the header.
  const pagesWithThead = await page.locator('.pagedjs_page:has(thead)').count();
  expect(pagesWithThead).toBeGreaterThan(1);
});
