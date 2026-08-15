import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * Strips the legacy `.woff` source from every @font-face.
 *
 * The non-variable fontsource packages list `woff2` then `woff`. Every browser
 * that can run this app — service workers, CSS custom properties, :lang() —
 * has supported woff2 for years, so the fallback is never fetched. Vite still
 * copies each referenced file into the build, and across ~910 CJK subsets that
 * is ~26 MB of dead weight in the deployed artifact.
 */
const stripWoffFallback = {
  postcssPlugin: 'wp-strip-woff-fallback',
  Declaration: {
    // Matched on format('woff') rather than the file extension: by the time
    // postcss runs, Vite has already rewritten every url() to a
    // __VITE_ASSET__<hash>__ placeholder, so the extension is long gone.
    src: (decl) => {
      if (!/format\(['"]woff['"]\)/.test(decl.value)) return;
      const next = decl.value
        .replace(/,\s*url\([^)]*\)\s*format\(['"]woff['"]\)/g, '')
        .trim();
      if (next) decl.value = next;
    },
  },
};

/**
 * Drops the .woff assets themselves. Removing the CSS reference above is not
 * enough — Vite registered the asset when it created the placeholder, so
 * Rollup would still emit ~26 MB of files nothing points at.
 */
const dropWoffAssets = {
  name: 'wp-drop-woff-assets',
  apply: 'build',
  generateBundle(_options, bundle) {
    let dropped = 0;
    let bytes = 0;
    for (const [fileName, asset] of Object.entries(bundle)) {
      if (!fileName.endsWith('.woff')) continue;
      bytes += asset.source?.length ?? 0;
      delete bundle[fileName];
      dropped++;
    }
    if (dropped) {
      this.info(
        `dropped ${dropped} legacy .woff assets (${(bytes / 1e6).toFixed(1)} MB)`,
      );
    }
  },
};

// Mirrors the upstream project's `homepage: "./"` so the build works from any
// subpath (GitHub Pages, Docker/nginx).
export default defineConfig({
  base: './',
  css: {
    postcss: { plugins: [stripWoffFallback] },
  },
  plugins: [
    react(),
    dropWoffAssets,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'og-image.png',
        'icons/*.png',
      ],
      workbox: {
        // Workbox's default glob omits woff2, which would leave the bundled
        // Inter/Source Serif/JetBrains Mono faces uncached — the app would come
        // up offline and silently fall back to system fonts.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        /*
         * ...but NOT the CJK faces. Noto Sans TC/SC/JP/KR ship ~910
         * unicode-range subsets totalling ~19 MB, and precaching is
         * all-or-nothing at install time: leaving them in makes every first
         * visit download 21.8 MB before the app is usable offline, to support
         * languages most users will never open.
         *
         * They are runtime-cached instead (below), so the two or three subsets
         * a document actually touches are stored permanently the first time it
         * is opened. Cost: a CJK document needs one online visit before it
         * works offline. Latin, Arabic and Hebrew stay precached — together
         * they are only ~690 KB.
         */
        globIgnores: ['**/noto-sans-{tc,sc,jp,kr}-*.woff2'],
        // The lazily-loaded Preview chunk carries all of highlight.js and is
        // over the 2 MiB default ceiling once source maps are off.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // Immutable, content-hashed filenames, so CacheFirst can never go
            // stale — a changed font is a changed URL.
            urlPattern: /noto-sans-(tc|sc|jp|kr)-.*\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'waynepdf-cjk-fonts',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'WaynePDF',
        short_name: 'WaynePDF',
        description:
          'Write Markdown. Get a beautiful PDF. Offline, private, and yours to configure.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: './',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
