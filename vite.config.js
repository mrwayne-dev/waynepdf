import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Mirrors upstream md2pdf `homepage: "./"` so the build works from any
// subpath (GitHub Pages, Docker/nginx).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'WaynePDF',
        short_name: 'WaynePDF',
        description:
          'Amazing Markdown to PDF — offline, private, and yours to configure.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: './index.html',
        icons: [
          {
            src: './icons/android-icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
          },
          {
            src: './icons/android-icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
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
