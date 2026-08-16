import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');

/**
 * lang/dir application and the per-language font stacks.
 *
 * Detection is debounced by 500ms when text arrives through the editor, so
 * every assertion here polls rather than reading once.
 */

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

async function load(page, fixture) {
  await page.evaluate((md) => window.__waynepdf_setText(md), read(fixture));
}

const attr = (page, name) =>
  page.evaluate(
    (n) => document.querySelector('.markdown-body').getAttribute(n),
    name,
  );

const fontFamily = (page) =>
  page.evaluate(
    () => getComputedStyle(document.querySelector('.markdown-body')).fontFamily,
  );

const gear = (page) => page.locator('button.wp-gear');

test.describe('lang detection is applied to the container', () => {
  const CASES = [
    ['cjk-tc.md', 'zh-Hant'],
    ['cjk-sc.md', 'zh-Hans'],
    ['cjk-ja.md', 'ja'],
    ['cjk-ko.md', 'ko'],
    ['rtl-arabic.md', 'ar'],
    ['rtl-hebrew.md', 'he'],
    ['basic.md', 'en'],
  ];

  for (const [fixture, lang] of CASES) {
    test(`${fixture} -> lang="${lang}"`, async ({ page }) => {
      await boot(page);
      await load(page, fixture);
      await expect
        .poll(() => attr(page, 'lang'), { timeout: 10_000 })
        .toBe(lang);
    });
  }
});

test.describe('dir follows the language', () => {
  test('Arabic gets dir="rtl"', async ({ page }) => {
    await boot(page);
    await load(page, 'rtl-arabic.md');
    await expect.poll(() => attr(page, 'dir'), { timeout: 10_000 }).toBe('rtl');
  });

  test('Hebrew gets dir="rtl"', async ({ page }) => {
    await boot(page);
    await load(page, 'rtl-hebrew.md');
    await expect.poll(() => attr(page, 'dir'), { timeout: 10_000 }).toBe('rtl');
  });

  test('English gets dir="ltr"', async ({ page }) => {
    await boot(page);
    await load(page, 'basic.md');
    await expect.poll(() => attr(page, 'dir'), { timeout: 10_000 }).toBe('ltr');
  });

  test('a majority-English document with Arabic passages stays ltr', async ({
    page,
  }) => {
    await boot(page);
    await load(page, 'mixed-directional.md');
    await expect.poll(() => attr(page, 'lang'), { timeout: 10_000 }).toBe('en');
    expect(await attr(page, 'dir')).toBe('ltr');
  });
});

test.describe('per-language font stacks', () => {
  const CASES = [
    ['cjk-tc.md', 'Noto Sans TC'],
    ['cjk-sc.md', 'Noto Sans SC'],
    ['cjk-ja.md', 'Noto Sans JP'],
    ['cjk-ko.md', 'Noto Sans KR'],
    ['rtl-arabic.md', 'Noto Sans Arabic'],
    ['rtl-hebrew.md', 'Noto Sans Hebrew'],
  ];

  for (const [fixture, family] of CASES) {
    test(`${fixture} resolves a stack containing ${family}`, async ({
      page,
    }) => {
      await boot(page);
      await load(page, fixture);
      await expect
        .poll(() => fontFamily(page), { timeout: 10_000 })
        .toContain(family);
    });
  }

  test('the script face precedes every generic keyword', async ({ page }) => {
    // Regression: the first draft led each stack with --wp-font-family-body,
    // which ends in `sans-serif`. A generic family always matches, so Noto sat
    // behind it, unreachable — the host's default font rendered the script and
    // the bundled face was never downloaded. Silently host-dependent output.
    await boot(page);
    await load(page, 'rtl-hebrew.md');
    await expect
      .poll(() => fontFamily(page), { timeout: 10_000 })
      .toContain('Noto Sans Hebrew');
    const stack = await fontFamily(page);
    const noto = stack.indexOf('Noto Sans Hebrew');
    const generic = stack.indexOf('sans-serif');
    expect(generic).toBeGreaterThan(-1);
    expect(noto).toBeLessThan(generic);
  });

  test('the bundled script face is actually downloaded, not just listed', async ({
    page,
  }) => {
    const fetched = [];
    page.on('response', (r) => {
      if (/\.woff2(\?|$)/.test(r.url())) fetched.push(r.url());
    });
    await boot(page);
    await load(page, 'rtl-hebrew.md');
    await expect
      .poll(() => fontFamily(page), { timeout: 10_000 })
      .toContain('Noto Sans Hebrew');
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(
        () => fetched.filter((u) => u.includes('noto-sans-hebrew')).length,
        {
          timeout: 10_000,
        },
      )
      .toBeGreaterThan(0);
  });

  test('the Latin face still leads the stack, so mixed text keeps Inter', async ({
    page,
  }) => {
    await boot(page);
    await load(page, 'cjk-ja.md');
    await expect
      .poll(() => fontFamily(page), { timeout: 10_000 })
      .toContain('Noto Sans JP');
    // Inter first means Latin runs inside a Japanese document stay in Inter;
    // only the characters Inter cannot cover fall through to Noto.
    const stack = await fontFamily(page);
    expect(stack.indexOf('Inter')).toBeLessThan(stack.indexOf('Noto Sans JP'));
  });

  test('code keeps the mono stack inside a CJK document', async ({ page }) => {
    await boot(page);
    await page.evaluate(() =>
      window.__waynepdf_setText(
        '# 日本語のテスト\n\n```js\nconst a = 1;\n```\n',
      ),
    );
    await expect.poll(() => attr(page, 'lang'), { timeout: 10_000 }).toBe('ja');
    const preFont = await page.evaluate(
      () => getComputedStyle(document.querySelector('.preview pre')).fontFamily,
    );
    expect(preFont).toContain('JetBrains Mono');
    expect(preFont).not.toContain('Noto Sans JP');
  });
});

test.describe('settings overrides win over detection', () => {
  test('forcing Japanese on a Traditional Chinese document', async ({
    page,
  }) => {
    await boot(page);
    await load(page, 'cjk-tc.md');
    await expect
      .poll(() => attr(page, 'lang'), { timeout: 10_000 })
      .toBe('zh-Hant');

    await gear(page).click();
    await page.locator('select.wp-select-language').selectOption('ja');

    await expect.poll(() => attr(page, 'lang')).toBe('ja');
    await expect.poll(() => fontFamily(page)).toContain('Noto Sans JP');
    expect(await fontFamily(page)).not.toContain('Noto Sans TC');
  });

  test('forcing LTR on Arabic flips the blockquote rail back', async ({
    page,
  }) => {
    await boot(page);
    await load(page, 'rtl-arabic.md');
    await expect.poll(() => attr(page, 'dir'), { timeout: 10_000 }).toBe('rtl');

    const rail = () =>
      page.evaluate(() => {
        const s = getComputedStyle(
          document.querySelector('.preview blockquote'),
        );
        return {
          left: parseFloat(s.borderLeftWidth),
          right: parseFloat(s.borderRightWidth),
        };
      });

    const rtlRail = await rail();
    expect(rtlRail.right).toBeGreaterThan(0);
    expect(rtlRail.left).toBe(0);

    await gear(page).click();
    await page.locator('label.wp-pill', { hasText: /^LTR$/ }).click();

    await expect.poll(() => attr(page, 'dir')).toBe('ltr');
    const ltrRail = await rail();
    expect(ltrRail.left).toBeGreaterThan(0);
    expect(ltrRail.right).toBe(0);
  });

  test('the detected language is still reported while overridden', async ({
    page,
  }) => {
    await boot(page);
    await load(page, 'cjk-ko.md');
    await gear(page).click();
    // Auto is selected, so the caption shows what detection found.
    await expect(page.locator('.wp-detected-lang')).toHaveText(
      'Detected: Korean',
      { timeout: 10_000 },
    );
  });

  test('both language settings survive a reload', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('select.wp-select-language').selectOption('he');
    await page.locator('label.wp-pill', { hasText: /^RTL$/ }).click();
    await expect.poll(() => attr(page, 'dir')).toBe('rtl');

    await page.reload();
    await expect(page.locator('.preview')).toBeVisible();

    await expect.poll(() => attr(page, 'lang'), { timeout: 10_000 }).toBe('he');
    expect(await attr(page, 'dir')).toBe('rtl');

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('waynepdf.language.v1')),
    );
    expect(stored).toEqual({ lang: 'he', direction: 'rtl' });
  });

  test('theme and language use two separate storage keys', async ({ page }) => {
    await boot(page);
    await gear(page).click();
    await page.locator('select.wp-select-language').selectOption('ja');
    await page.locator('button.wp-swatch[data-theme="dark"]').click();

    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    expect(keys).toEqual([
      'waynepdf.language.v1',
      'waynepdf.layout.v1',
      'waynepdf.settings.v1',
    ]);
  });
});
