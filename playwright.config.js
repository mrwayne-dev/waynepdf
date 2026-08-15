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
  projects: [
    {
      // Chromium only: page.pdf() is Chromium-exclusive and matches the
      // Skia/PDF engine that window.print() reaches in the real app.
      name: 'chromium',
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
