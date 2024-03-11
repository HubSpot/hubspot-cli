const os = require('os');
const { checkGitInclusion } = require('@hubspot/local-dev-lib/gitignore');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.ui.git';

function checkAndWarnGitInclusion(configPath) {
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

module.exports = {
  checkAndWarnGitInclusion,
};
