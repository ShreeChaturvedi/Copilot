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
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'packages/**',
      'api/**',
      'lib/**',
      'test/**',
    ],
  },
});
