/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./setup'],
    include: ['./tests/**/*.spec.ts'],
    exclude: ['./lib/**/*'],
    // Don't run the test files in parallel.
    // To accomplish this, we need to refactor the tests so there aren't filesystem collisions
    fileParallelism: false,
  },
});
