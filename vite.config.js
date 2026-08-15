import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Mirrors the upstream project's `homepage: "./"` so the build works from any
// subpath (GitHub Pages, Docker/nginx).
export default defineConfig({
  base: './',
  plugins: [
    react(),
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
        // The lazily-loaded Preview chunk carries all of highlight.js and is
        // over the 2 MiB default ceiling once source maps are off.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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
