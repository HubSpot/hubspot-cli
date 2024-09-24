import { initializeAuth } from './lib/auth';
import { afterAll, beforeAll, vi } from 'vitest';
import { CONFIG_FILE_NAME } from './lib/constants';
import rimraf from 'rimraf';

beforeAll(async () => {
  rimraf.sync(CONFIG_FILE_NAME);

  // Fetch access token for target account and save parsed config for use in tests
  await initializeAuth();
});

afterAll(() => {
  rimraf.sync(CONFIG_FILE_NAME);
});
