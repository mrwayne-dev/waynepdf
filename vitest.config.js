import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { appDefines } from './scripts/appDefines.js';

export default defineConfig({
  plugins: [react()],
  // Same constants the real build injects; see scripts/appDefines.js.
  define: appDefines(import.meta.url),
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
    // Both extensions in both trees: a component test has to be .jsx to parse,
    // and a .jsx under tests/unit silently matched nothing before 7.0.
    include: [
      'src/**/*.{test,spec}.{js,jsx}',
      'tests/unit/**/*.{test,spec}.{js,jsx}',
    ],
    exclude: ['node_modules', 'dist', '.reference', 'tests/e2e'],
  },
});
