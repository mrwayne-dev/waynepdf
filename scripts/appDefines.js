import { readFileSync } from 'node:fs';

/*
 * Build-time constants injected into the client bundle.
 *
 * Shared by vite.config.js and vitest.config.js so the two cannot disagree —
 * they did briefly, and the symptom was every test that mounts the app failing
 * to collect with "__WAYNEPDF_VERSION__ is not defined" while the build was
 * perfectly happy.
 *
 * Read from the manifest rather than imported by a component: importing
 * package.json would pull every dependency name and version into the bundle to
 * display one version string.
 */
export function appDefines(rootUrl) {
  const pkg = JSON.parse(
    readFileSync(new URL('./package.json', rootUrl), 'utf8'),
  );
  return {
    __WAYNEPDF_VERSION__: JSON.stringify(pkg.version),
    __WAYNEPDF_HOMEPAGE__: JSON.stringify(pkg.homepage ?? ''),
  };
}
