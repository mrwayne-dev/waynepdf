import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// NOTE: ESLint 9 uses flat config. The Phase 0 spec listed `.eslintrc.json`,
// but eslintrc under ESLint 9 requires the deprecated ESLINT_USE_FLAT_CONFIG=false
// escape hatch (removed in ESLint 10). See PHASE_0_SUMMARY.md.

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  console: 'readonly',
  alert: 'readonly',
  FileReader: 'readonly',
  requestAnimationFrame: 'readonly',
  URL: 'readonly',
  Blob: 'readonly',
  HTMLElement: 'readonly',
  Range: 'readonly',
  DataTransfer: 'readonly',
  DragEvent: 'readonly',
  File: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  getComputedStyle: 'readonly',
  localStorage: 'readonly',
  matchMedia: 'readonly',
};

const nodeGlobals = {
  process: 'readonly',
  __dirname: 'readonly',
  Buffer: 'readonly',
  global: 'readonly',
};

const vitestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  vi: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
};

export default [
  { ignores: ['dist/**', '.reference/**', 'node_modules/**', 'dev-dist/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...browserGlobals, ...nodeGlobals },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // The new JSX transform means React need not be in scope.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Preview.jsx intentionally renders parser output as HTML (Phase 6 sanitizes).
      'react/no-danger': 'off',
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
  {
    files: ['tests/**/*.{js,jsx}', 'src/**/*.{test,spec}.{js,jsx}'],
    languageOptions: {
      globals: { ...browserGlobals, ...nodeGlobals, ...vitestGlobals },
    },
  },
];
