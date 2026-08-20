import { test, expect } from '@playwright/test';
import {
  boot,
  setText,
  themeSettings,
  openPreferences,
  closePreferences,
  prefs,
} from './_helpers.js';

/**
 * The preferences window: open/close, section navigation, search, and the
 * migration invariant that every setting survived the move off the slide-out.
 */

const rail = (page, id) =>
  page.locator(`.wp-prefs-rail-item[data-section="${id}"]`);

const accelerator = process.platform === 'darwin' ? 'Meta' : 'Control';

test.describe('open and close', () => {
  test('the keyboard shortcut opens and closes the window', async ({
    page,
  }) => {
    await boot(page);
    /*
     * Focus a plain button first. The shortcut yields to text fields by design
     * and CodeMirror holds focus on load, so pressing it straight after boot
     * would correctly do nothing.
     */
    await page.getByRole('button', { name: 'Flowing' }).focus();
    await page.keyboard.press(`${accelerator}+Comma`);
    await expect(prefs(page)).toBeVisible();
    await page.keyboard.press(`${accelerator}+Comma`);
    await expect(prefs(page)).toHaveCount(0);
  });

  test('Esc closes it', async ({ page }) => {
    await boot(page);
    await openPreferences(page);
    await page.keyboard.press('Escape');
    await expect(prefs(page)).toHaveCount(0);
  });

  test('the close button closes it', async ({ page }) => {
    await boot(page);
    await openPreferences(page);
    await closePreferences(page);
  });

  test('focus lands on search and returns to the opener', async ({ page }) => {
    await boot(page);
    await openPreferences(page);
    await expect(page.getByLabel('Search preferences')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('button.wp-gear')).toBeFocused();
  });

  test('the workspace stays mounted underneath', async ({ page }) => {
    /*
     * The reason this is an overlay and not a route. Unmounting the editor to
     * show preferences would drop the CodeMirror buffer and the preview scroll
     * position — a user who opens preferences mid-document must get their
     * document back exactly as they left it.
     */
    await boot(page);
    await setText(page, '# Kept\n\n' + 'filler paragraph\n\n'.repeat(60));
    await expect(page.locator('.preview h1')).toHaveText('Kept');

    const scrollTo = 400;
    await page.locator('.preview').evaluate((el, y) => {
      el.scrollTop = y;
    }, scrollTo);

    await openPreferences(page);
    // Still in the DOM, merely covered.
    await expect(page.locator('.preview h1')).toHaveText('Kept');
    await closePreferences(page);

    await expect(page.locator('.preview h1')).toHaveText('Kept');
    expect(
      await page.locator('.preview').evaluate((el) => el.scrollTop),
    ).toBe(scrollTo);
  });
});

test.describe('sections', () => {
  const SECTIONS = [
    ['appearance', 'Appearance'],
    ['editor', 'Editor'],
    ['document', 'Document'],
    ['layout', 'Layout'],
    ['themes', 'Themes'],
    ['about', 'About'],
  ];

  test('all six are listed', async ({ page }) => {
    await boot(page);
    await openPreferences(page);
    await expect(page.locator('.wp-prefs-rail-item')).toHaveCount(6);
  });

  for (const [id, label] of SECTIONS) {
    test(`${id} renders when selected`, async ({ page }) => {
      await boot(page);
      await openPreferences(page, id);
      await expect(rail(page, id)).toHaveAttribute('aria-current', 'true');
      await expect(page.locator('.wp-prefs-section-title')).toHaveText(label);
    });
  }

  test('appearance is the section shown first', async ({ page }) => {
    await boot(page);
    await openPreferences(page);
    await expect(rail(page, 'appearance')).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('arrow keys move down the rail and wrap', async ({ page }) => {
    await boot(page);
    await openPreferences(page);
    await rail(page, 'appearance').focus();

    await page.keyboard.press('ArrowDown');
    await expect(rail(page, 'editor')).toHaveAttribute('aria-current', 'true');

    await page.keyboard.press('ArrowUp');
    await expect(rail(page, 'appearance')).toHaveAttribute(
      'aria-current',
      'true',
    );

    // Wraps to the last section rather than dead-ending on the first.
    await page.keyboard.press('ArrowUp');
    await expect(rail(page, 'about')).toHaveAttribute('aria-current', 'true');
  });

  test('About shows a real version, not a placeholder', async ({ page }) => {
    await boot(page);
    await openPreferences(page, 'about');
    await expect(page.getByTestId('wp-version')).toHaveText(
      /WaynePDF \d+\.\d+\.\d+/,
    );
  });
});

test.describe('search', () => {
  test('filters the rail to the sections that own a match', async ({
    page,
  }) => {
    await boot(page);
    await openPreferences(page);
    await page.getByLabel('Search preferences').fill('line height');

    await expect(rail(page, 'appearance')).toBeVisible();
    for (const id of ['editor', 'document', 'layout', 'themes', 'about']) {
      await expect(rail(page, id)).toBeHidden();
    }
  });

  test('filters controls within a section', async ({ page }) => {
    await boot(page);
    await openPreferences(page);
    await page.getByLabel('Search preferences').fill('line height');

    await expect(
      page.locator('.wp-prefs-field[data-field-label*="Line height"]'),
    ).toBeVisible();
    await expect(
      page.locator('.wp-prefs-field[data-field-label*="Font family"]'),
    ).toBeHidden();
  });

  test('reaches a section rendered whole through its aliases', async ({
    page,
  }) => {
    // Layout has no per-field labels of its own; "margins" can only find it
    // through the section's alias list.
    await boot(page);
    await openPreferences(page);
    await page.getByLabel('Search preferences').fill('margins');
    await expect(rail(page, 'layout')).toBeVisible();
    await expect(rail(page, 'appearance')).toBeHidden();
  });

  test('says so when nothing matches', async ({ page }) => {
    await boot(page);
    await openPreferences(page);
    await page.getByLabel('Search preferences').fill('zzzznope');
    await expect(page.locator('.wp-prefs-empty')).toContainText('No preferences match');
  });

  test('clearing the search restores everything', async ({ page }) => {
    await boot(page);
    await openPreferences(page);
    const search = page.getByLabel('Search preferences');
    await search.fill('line height');
    await expect(rail(page, 'layout')).toBeHidden();
    await search.fill('');
    await expect(page.locator('.wp-prefs-rail-item:visible')).toHaveCount(6);
  });
});

/**
 * The migration invariant.
 *
 * Every control that the slide-out panel exposed must still be reachable and
 * functional somewhere in the new window. A setting silently dropped during the
 * move would otherwise be invisible until a user went looking for it — this
 * enumerates them and fails loudly instead.
 */
test.describe('every setting survived the migration', () => {
  const CONTROLS = [
    ['appearance', 'button.wp-swatch[data-theme="dark"]'],
    ['appearance', 'button.wp-swatch[data-theme="sepia"]'],
    ['appearance', 'button.wp-swatch[data-theme="high-contrast"]'],
    ['appearance', 'button.wp-swatch[data-theme="print-optimized"]'],
    // The System swatch carries no data-theme: it renders as split light/dark
    // halves rather than resolving one palette.
    ['appearance', 'button.wp-swatch:has(.wp-swatch-system)'],
    ['appearance', 'label.wp-pill:has-text("Sans")'],
    ['appearance', 'label.wp-pill:has-text("Serif")'],
    ['appearance', 'label.wp-pill:has-text("Mono")'],
    ['editor', 'input[type="range"]'],
    ['document', 'select.wp-select-language'],
    ['document', 'label.wp-pill:has-text("RTL")'],
    ['document', 'input[type="checkbox"]'],
    ['themes', '.wp-custom-themes'],
    ['layout', 'select'],
  ];

  for (const [section, selector] of CONTROLS) {
    test(`${section}: ${selector}`, async ({ page }) => {
      await boot(page, { theme: themeSettings() });
      await openPreferences(page, section);
      await expect(page.locator(selector).first()).toBeVisible();
    });
  }

  test('the three Appearance sliders are all present and labelled', async ({
    page,
  }) => {
    await boot(page, { theme: themeSettings() });
    await openPreferences(page, 'appearance');
    for (const label of ['Body size', 'Line height', 'Code size']) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
  });

  test('the math and sanitize toggles both work', async ({ page }) => {
    await boot(page, { theme: themeSettings() });
    await openPreferences(page, 'document');

    const math = page.getByRole('checkbox', {
      name: 'Show copy button on math',
    });
    const sanitize = page.getByRole('checkbox', {
      name: 'Sanitize HTML output',
    });
    await expect(math).toBeChecked();
    await expect(sanitize).not.toBeChecked();

    await math.uncheck();
    await sanitize.check();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const s = JSON.parse(
            localStorage.getItem('waynepdf.settings.v1') ?? '{}',
          );
          return [s.mathCopyEnabled, s.sanitizeHtml];
        }),
      )
      .toEqual([false, true]);
  });

  test('the Layout section exposes page setup and the frontmatter note', async ({
    page,
  }) => {
    await boot(page);
    await openPreferences(page, 'layout');
    await expect(page.locator('.wp-prefs-note')).toContainText(
      'Frontmatter in a document can override',
    );
    await expect(page.getByLabel('Page size')).toBeVisible();
  });

  test('the editor font size is its own setting, separate from code size', async ({
    page,
  }) => {
    /*
     * New in 7.0. The editor used to borrow the document's code-size variable,
     * which conflated "how big is fenced code in my PDF" with "how big is the
     * source while I write".
     */
    await boot(page, { theme: themeSettings() });
    await openPreferences(page, 'editor');
    await page.getByLabel('Editor font size').fill('20');

    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue('--wp-font-size-editor')
            .trim(),
        ),
      )
      .toBe('20px');

    // The document's own code size is untouched by it.
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--wp-font-size-code')
          .trim(),
      ),
    ).toBe('14px');
  });
});

test.describe('reset', () => {
  test('the footer reset asks first and can be cancelled', async ({ page }) => {
    await boot(page);
    await openPreferences(page, 'appearance');
    await page.locator('button.wp-swatch[data-theme="dark"]').click();

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Reset everything' }).click();

    // Cancelled: the window stays open and the theme stays chosen.
    await expect(prefs(page)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.dataset.theme),
    ).toBe('dark');
  });
});
