import { getTestConfig } from '../lib/env';
import * as cmd from './helpers/cmd';

import { initializeAuth } from './helpers/auth';
import { afterAll, beforeAll } from 'vitest';
import { CONFIG_FILE_NAME } from '../lib/constants';
import rimraf from 'rimraf';

beforeAll(async () => {
  console.log('Running');
  rimraf.sync(CONFIG_FILE_NAME);
  global.config = getTestConfig();

  global.config.debug = true;

  global.cli = cmd.createCli(global.config.cliPath, global.config.cliVersion);

  // Fetch access token for target account and save parsed config for use in tests
  await initializeAuth();
});

afterAll(() => {
  rimraf.sync(CONFIG_FILE_NAME);
});
