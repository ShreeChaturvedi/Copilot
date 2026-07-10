/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(
        new URL('./packages/shared/src', import.meta.url)
      ),
      '@backend': fileURLToPath(
        new URL('./packages/backend/src', import.meta.url)
      ),
      '@api': fileURLToPath(new URL('./api', import.meta.url)),
      '@lib': fileURLToPath(new URL('./lib', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // The jsdom suite grew past a single fork's default ~4GB V8 heap: every
    // test passes, but a worker OOMs ("Reached heap limit") and exits non-zero,
    // failing CI. Bound the fork count and raise each fork's heap so the total
    // stays well under a 16GB runner while giving each worker generous headroom.
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2,
        minForks: 1,
        execArgv: ['--max-old-space-size=6144'],
      },
    },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'packages/**',
      'api/**',
      'lib/**',
      'test/**',
      // L5 Playwright specs use their own runner (npm run test:e2e).
      'e2e/**',
    ],
  },
});
