import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['./tests/**/*.spec.ts'],
    exclude: ['./lib/**/*'],
    testTimeout: 60000,
    hookTimeout: 30000,
    fileParallelism: false,
    globalSetup: './globalSetup.ts',
    globals: true,
  },
});
