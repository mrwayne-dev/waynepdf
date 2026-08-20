import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { appDefines } from './scripts/appDefines.js';

/**
 * Legacy @font-face formats we refuse to ship.
 *
 * The non-variable fontsource packages list `woff2` then `woff`; KaTeX lists
 * `woff2`, `woff`, then `truetype`. Every browser that can run this app —
 * service workers, CSS custom properties, :lang() — has supported woff2 for
 * years, so neither fallback is ever fetched. Vite still copies each
 * referenced file into the build: ~26 MB across the CJK subsets, plus another
 * ~0.5 MB of KaTeX .ttf.
 */
const LEGACY_FONT_FORMATS = ['woff', 'truetype'];
const LEGACY_FONT_EXTENSIONS = ['.woff', '.ttf'];

const stripLegacyFontFallbacks = {
  postcssPlugin: 'wp-strip-legacy-font-fallbacks',
  Declaration: {
    // Matched on the format() keyword rather than the file extension: by the
    // time postcss runs, Vite has already rewritten every url() to a
    // __VITE_ASSET__<hash>__ placeholder, so the extension is long gone.
    src: (decl) => {
      let next = decl.value;
      for (const format of LEGACY_FONT_FORMATS) {
        if (!new RegExp(`format\\(['"]${format}['"]\\)`).test(next)) continue;
        next = next.replace(
          new RegExp(
            `,\\s*url\\([^)]*\\)\\s*format\\(['"]${format}['"]\\)`,
            'g',
          ),
          '',
        );
      }
      next = next.trim();
      if (next && next !== decl.value) decl.value = next;
    },
  },
};

/**
 * Drops the legacy font assets themselves. Removing the CSS reference above is
 * not enough — Vite registered the asset when it created the placeholder, so
 * Rollup would still emit the files with nothing pointing at them.
 */
const dropLegacyFontAssets = {
  name: 'wp-drop-legacy-font-assets',
  apply: 'build',
  generateBundle(_options, bundle) {
    let dropped = 0;
    let bytes = 0;
    for (const [fileName, asset] of Object.entries(bundle)) {
      if (!LEGACY_FONT_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
        continue;
      }
      bytes += asset.source?.length ?? 0;
      delete bundle[fileName];
      dropped++;
    }
    if (dropped) {
      this.info(
        `dropped ${dropped} legacy font assets (${(bytes / 1e6).toFixed(1)} MB)`,
      );
    }
  },
};

// Mirrors the upstream project's `homepage: "./"` so the build works from any
// subpath (GitHub Pages, Docker/nginx).
export default defineConfig({
  base: './',
  define: appDefines(import.meta.url),
  css: {
    postcss: { plugins: [stripLegacyFontFallbacks] },
  },
  build: {
    rollupOptions: {
      output: {
        /*
         * Mermaid splits itself into ~64 lazy chunks, one per diagram type,
         * totalling ~4.4 MB. Left in the default assets/ directory they all
         * land in the Workbox precache, which pushed first-visit cost from
         * 3.7 MB to 7.2 MB — force-downloading a diagram engine most documents
         * never use, which is exactly the trap Phase 3 fixed for the CJK fonts.
         *
         * Routing them into assets/mermaid/ makes them globbable so the service
         * worker can runtime-cache them instead. The per-diagram splitting is
         * kept deliberately: merging them into one chunk would mean a flowchart
         * downloads the Gantt, ER and C4 renderers too.
         */
        chunkFileNames(chunk) {
          const ids = chunk.moduleIds ?? [];
          const isMermaid = ids.some((id) =>
            /node_modules\/(\.pnpm\/)?(mermaid|@mermaid-js|cytoscape|dagre-d3-es|elkjs|khroma)/.test(
              id,
            ),
          );
          return isMermaid
            ? 'assets/mermaid/[name]-[hash].js'
            : 'assets/[name]-[hash].js';
        },
      },
    },
  },
  plugins: [
    react(),
    dropLegacyFontAssets,
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
        globIgnores: [
          '**/noto-sans-{tc,sc,jp,kr}-*.woff2',
          'assets/mermaid/**',
        ],
        // The lazily-loaded Preview chunk carries all of highlight.js and is
        // over the 2 MiB default ceiling once source maps are off.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // Same reasoning as the CJK fonts: content-hashed and only fetched
            // when a document actually contains a diagram of that type.
            urlPattern: /\/assets\/mermaid\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'waynepdf-mermaid',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
