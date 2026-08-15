import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    // Playwright owns tests/e2e; Vitest must not try to run those specs.
    include: ['src/**/*.{test,spec}.{js,jsx}', 'tests/unit/**/*.{test,spec}.js'],
    exclude: ['node_modules', 'dist', '.reference', 'tests/e2e'],
  },
});
