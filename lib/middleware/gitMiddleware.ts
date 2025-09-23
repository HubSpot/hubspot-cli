import { Arguments } from 'yargs';
import { getConfigPath, configFileExists } from '@hubspot/local-dev-lib/config';
import { checkAndWarnGitInclusion } from '../ui/git.js';

export function checkAndWarnGitInclusionMiddleware(argv: Arguments): void {
  // Skip this when no command is provided
  if (argv._.length) {
    // Skip if using global config
    if (configFileExists(true)) {
      return;
    }

    const configPath = getConfigPath();

    if (configPath) {
      checkAndWarnGitInclusion(configPath);
    }
  }
}
