/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    root: './tests',
    setupFiles: ['./setup'],
    include: ['./**/*.spec.ts'],
    exclude: ['./helpers/**/*'],
    env: {
      ACCOUNT_ID: '123456',
      PERSONAL_ACCESS_KEY: 'asdfsadfasdf',
      CLI_VERSION: 'latest',
    },
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
