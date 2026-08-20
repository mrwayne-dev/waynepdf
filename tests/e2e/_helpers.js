import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Fixture reader that works from tests/e2e and tests/e2e/paged alike. */
export const readFixture = (name) =>
  fs.readFileSync(path.resolve(HERE, '../fixtures', name), 'utf8');

export const THEME_KEY = 'waynepdf.settings.v1';
export const LAYOUT_KEY = 'waynepdf.layout.v1';

export const themeSettings = (over = {}) =>
  JSON.stringify({
    theme: 'light',
    fontFamily: 'sans',
    fontSize: 16,
    lineHeight: 1.6,
    codeFontSize: 14,
    mathCopyEnabled: true,
    sanitizeHtml: false,
    ...over,
  });

/** Seeds localStorage before first paint and waits for the app to be usable. */
export async function boot(page, { theme, layout } = {}) {
  if (theme) {
    await page.addInitScript(
      ([k, v]) => window.localStorage.setItem(k, v),
      [THEME_KEY, theme],
    );
  }
  if (layout) {
    await page.addInitScript(
      ([k, v]) => window.localStorage.setItem(k, v),
      [LAYOUT_KEY, layout],
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

export const setText = (page, text) =>
  page.evaluate((t) => window.__waynepdf_setText(t), text);

export const loadFixture = (page, name) => setText(page, readFixture(name));

/** The preferences window, absent from the DOM entirely while closed. */
export const prefs = (page) => page.locator('.wp-prefs');

/**
 * Opens preferences and optionally selects a section.
 *
 * Goes through the gear rather than the keyboard because that is the path a
 * user takes, and because Cmd+, deliberately does nothing while focus is in the
 * editor — which is where focus usually is.
 */
export async function openPreferences(page, section) {
  if ((await prefs(page).count()) === 0) {
    await page.locator('button.wp-gear').click();
  }
  await expect(prefs(page)).toBeVisible();
  if (section) {
    await page.locator(`.wp-prefs-rail-item[data-section="${section}"]`).click();
  }
}

export async function closePreferences(page) {
  await page.getByRole('button', { name: 'Close preferences' }).click();
  await expect(prefs(page)).toHaveCount(0);
}

/**
 * Clicks Reset in the preferences footer, accepts the confirmation, and waits
 * out the reload.
 *
 * The reload needs an unambiguous settle signal, not a timeout: a marker planted
 * on `window` before the click is gone once — and only once — the new document
 * has replaced the old one.
 */
export async function resetEverything(page) {
  const MARKER = '__waynepdf_pre_reset';
  await page.evaluate((k) => {
    window[k] = true;
  }, MARKER);

  // Reset moved into the preferences footer in 7.0; it has to be open first.
  await openPreferences(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Reset everything' }).click();

  await page.waitForFunction((k) => window[k] === undefined, MARKER, {
    timeout: 30_000,
  });
  await page.waitForFunction(
    () => typeof window.__waynepdf_setText === 'function',
    { timeout: 30_000 },
  );
  await expect(page.locator('#suspense-loading')).toHaveCount(0, {
    timeout: 30_000,
  });
}
