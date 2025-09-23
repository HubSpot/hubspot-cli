import os from 'os';
import { checkGitInclusion } from '@hubspot/local-dev-lib/gitignore';
import { logger } from '@hubspot/local-dev-lib/logger';
import { i18n } from '../lang.js';
import { uiLine } from './index.js';

export function checkAndWarnGitInclusion(configPath: string): void {
  try {
    const { inGit, configIgnored } = checkGitInclusion(configPath);

    if (!inGit || configIgnored) return;
    uiLine();
    logger.warn(i18n(`lib.ui.git.securityIssue`));
    logger.log(i18n(`lib.ui.git.configFileTracked`));
    logger.log(i18n(`lib.ui.git.fileName`, { configPath }));
    logger.log('');
    logger.log(i18n(`lib.ui.git.remediate`));
    logger.log(i18n(`lib.ui.git.moveConfig`, { homeDir: os.homedir() }));
    logger.log(i18n(`lib.ui.git.addGitignore`, { configPath }));
    logger.log(i18n(`lib.ui.git.noRemote`));
    uiLine();
    logger.log('');
  } catch (e) {
    // fail silently
    logger.debug(i18n(`lib.ui.git.checkFailed`));
  }
}
