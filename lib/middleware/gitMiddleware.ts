import { Arguments } from 'yargs';
import {
  getConfigFilePath,
  globalConfigFileExists,
} from '@hubspot/local-dev-lib/config';
import { ENVIRONMENT_VARIABLES } from '@hubspot/local-dev-lib/constants/config';
import { checkAndWarnGitInclusion } from '../ui/git.js';
import { debugError } from '../errorHandlers/index.js';

export function checkAndWarnGitInclusionMiddleware(argv: Arguments): void {
  // Skip this when no command is provided or if using environment config
  if (
    argv._.length &&
    !process.env[ENVIRONMENT_VARIABLES.USE_ENVIRONMENT_HUBSPOT_CONFIG]
  ) {
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
