/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./setup'],
    include: ['./tests/**/*.spec.ts'],
    exclude: ['./lib/**/*'],
    fileParallelism: false,
  },
});
