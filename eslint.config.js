import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { globalIgnores } from 'eslint/config';

export default tseslint.config([
  // Global ignores
  globalIgnores([
    'dist',
    'node_modules',
    '**/*.d.ts',
    'packages/*/dist',
    // Explicitly ignore legacy/untyped sources that cause parse errors
    'shared/**',
    '.shree/**',
    'screenshots/**',
  ]),

  // Frontend configuration
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },

  // Backend configuration (serverless api/ and local lib/ helpers, plus monorepo backend)
  {
    files: ['packages/backend/**/*.ts', 'api/**/*.ts', 'lib/**/*.ts'],
    ignores: [],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {},
  },

  // Root test utilities (ensure TS parser for declare global, etc.)
  {
    files: ['test/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },

  // Shared package configuration (types-only, strict TS)
  {
    files: ['packages/shared/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
]);
