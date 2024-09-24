/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    root: './tests',
    setupFiles: ['./setup'],
    include: ['./**/*.spec.ts'],
    exclude: ['./helpers/**/*'],
    fileParallelism: false,
  },
});
