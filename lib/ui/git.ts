import os from 'os';
import { checkGitInclusion } from '@hubspot/local-dev-lib/gitignore';
import { logger } from '@hubspot/local-dev-lib/logger';
import { i18n } from '../lang';


export function checkAndWarnGitInclusion(configPath: string): void {
  try {
    const { inGit, configIgnored } = checkGitInclusion(configPath);

    if (!inGit || configIgnored) return;
    logger.warn(i18n(`lib.ui.git.securityIssue`));
    logger.warn(i18n(`lib.ui.git.configFileTracked`));
    logger.warn(i18n(`lib.ui.git.fileName`, { configPath }));
    logger.warn(i18n(`lib.ui.git.remediate`));
    logger.warn(i18n(`lib.ui.git.moveConfig`, { homeDir: os.homedir() }));
    logger.warn(i18n(`lib.ui.git.addGitignore`, { configPath }));
    logger.warn(i18n(`lib.ui.git.noRemote`));
  } catch (e) {
    // fail silently
    logger.debug(i18n(`lib.ui.git.checkFailed`));
  }
}
