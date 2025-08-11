/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '~': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'api/**/*.test.ts',
      'lib/**/*.test.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'src/**', // Frontend tests use separate config
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'api/**/*.ts',
        'lib/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        'node_modules/**',
        'dist/**',
      ],
    },
    setupFiles: ['./test/backend-setup.ts'],
  },
});