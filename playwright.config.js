import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  snapshotDir: './tests/e2e/__snapshots__',
  expect: {
    toHaveScreenshot: {
      // Keep image baselines out of __snapshots__, which holds the rendered-HTML
      // text snapshots. Separate trees because they are reviewed differently:
      // the HTML diffs are read line by line, the images are eyeballed.
      pathTemplate: './tests/e2e/__screenshots__/{arg}{ext}',
    },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  /*
   * Two projects, split by cost rather than by browser.
   *
   * Pagination is CPU-bound and takes seconds per run. With the default worker
   * count, several paginations compete for one core and the whole file times out
   * even though every test passes alone — Phase 5 worked around that with
   * per-file `mode: 'serial'` and a 150s timeout, which slowed the paged tests
   * down and left the timeout papering over real contention.
   *
   * Isolating them into a single-worker project fixes the cause: the paged
   * project never contends with itself, and every other spec keeps full
   * parallelism. Both stay Chromium-only — page.pdf() is Chromium-exclusive and
   * matches the Skia/PDF engine window.print() reaches in the real app.
   */
  projects: [
    {
      name: 'parallel',
      testDir: './tests/e2e',
      testIgnore: ['**/paged/**'],
      fullyParallel: true,
      /*
       * Capped rather than left to Playwright's 50%-of-cores default. Each
       * worker runs a Chromium loading an app that carries ~19 MB of bundled
       * fonts, and the cross-theme specs boot the page five times apiece. On a
       * 7 GB machine the default over-subscribes memory and Chromium starts
       * dying mid-test with "Protocol error … session closed" — a crash, not a
       * test failure, and one that moves around between runs.
       */
      workers: 4,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'paged',
      testDir: './tests/e2e/paged',
      workers: 1,
      fullyParallel: false,
      timeout: 60_000,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // `vite --mode test` so the window.__waynepdf_setText hook is compiled in.
    command: `pnpm vite --mode test --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
