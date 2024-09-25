/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['./tests/**/*.spec.ts'],
    exclude: ['./lib/**/*'],
    testTimeout: 30000,
    hookTimeout: 20000,
  },
});
