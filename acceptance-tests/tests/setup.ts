import { getTestConfig } from '../lib/env';
import * as cmd from './helpers/cmd';

import { initializeAuth } from './helpers/auth';

(async () => {
  global.config = getTestConfig();
  global.cli = cmd.createCli(global.config.cliPath, global.config.cliVersion);

  // Fetch access token for target account and save parsed config for use in tests
  await initializeAuth();
})();
