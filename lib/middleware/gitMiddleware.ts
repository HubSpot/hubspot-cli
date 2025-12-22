import { Arguments } from 'yargs';
import {
  getConfigFilePath,
  globalConfigFileExists,
} from '@hubspot/local-dev-lib/config';
import { checkAndWarnGitInclusion } from '../ui/git.js';
import { debugError } from '../errorHandlers/index.js';
export function checkAndWarnGitInclusionMiddleware(argv: Arguments): void {
  // Skip this when no command is provided
  if (argv._.length) {
    // Skip if using global config
    if (globalConfigFileExists()) {
      return;
    }

    try {
      const configPath = getConfigFilePath();
      checkAndWarnGitInclusion(configPath);
    } catch (error) {
      debugError(error);
    }
  }
}
