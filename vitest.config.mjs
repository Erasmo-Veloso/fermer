import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/**/tests/**/*.{test,spec}.ts',
      'apps/**/tests/**/*.{test,spec}.ts',
      'tests/e2e/**/*.{test,spec}.ts',
    ],
    coverage: {
      enabled: false,
    },
  },
});
