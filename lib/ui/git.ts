import os from 'os';
import { checkGitInclusion } from '@hubspot/local-dev-lib/gitignore';
import { logger } from '@hubspot/local-dev-lib/logger';
import { i18n } from '../lang';

const i18nKey = 'lib.ui.git';

export function checkAndWarnGitInclusion(configPath: string): void {
  try {
    const { inGit, configIgnored } = checkGitInclusion(configPath);

    if (!inGit || configIgnored) return;
    logger.warn(i18n(`${i18nKey}.securityIssue`));
    logger.warn(i18n(`${i18nKey}.configFileTracked`));
    logger.warn(i18n(`${i18nKey}.fileName`, { configPath }));
    logger.warn(i18n(`${i18nKey}.remediate`));
    logger.warn(i18n(`${i18nKey}.moveConfig`, { homeDir: os.homedir() }));
    logger.warn(i18n(`${i18nKey}.addGitignore`, { configPath }));
    logger.warn(i18n(`${i18nKey}.noRemote`));
  } catch (e) {
    // fail silently
    logger.debug(i18n(`${i18nKey}.checkFailed`));
  }
}
