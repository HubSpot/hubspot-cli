const { checkGitInclusion } = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const path = require('path');
const os = require('os');

const checkAndWarnGitInclusion = configPath => {
  try {
    const { inGit, configIgnored } = checkGitInclusion(configPath);

    if (!inGit || configIgnored) return;
    logger.warn('Security Issue Detected');
    logger.warn('The HubSpot config file can be tracked by git.');
    logger.warn(`File: "${configPath}"`);
    logger.warn(`To remediate:
      - Move the config file to your home directory: "${os.homedir()}"
      - Add gitignore pattern "${path.basename(
        configPath
      )}" to a .gitignore file in root of your repository.
      - Ensure that the config file has not already been pushed to a remote repository.
    `);
  } catch (e) {
    // fail silently
    logger.debug(
      'Unable to determine if config file is properly ignored by git.'
    );
  }
};

module.exports = {
  checkAndWarnGitInclusion,
};
