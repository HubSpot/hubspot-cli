import { Arguments } from 'yargs';
import { getConfigPath } from '@hubspot/local-dev-lib/config';
import { checkAndWarnGitInclusion } from '../ui/git';

export function checkAndWarnGitInclusionMiddleware(argv: Arguments): void {
  // Skip this when no command is provided
  if (argv._.length) {
    const configPath = getConfigPath()!;

    if (configPath) {
      checkAndWarnGitInclusion(configPath);
    }
  }
}
