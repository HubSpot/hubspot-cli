import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    clearMocks: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/acceptance-tests/**', '**/node_modules/**', '**/dist/**'],
  },
  root: '.',
});
