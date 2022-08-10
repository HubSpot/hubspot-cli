const chalk = require('chalk');
const supportsHyperlinks = require('../lib/supportHyperlinks');
const supportsColor = require('../lib/supportsColor');
const { getAccountConfig } = require('@hubspot/cli-lib/lib/config');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');

/**
 * Outputs horizontal line
 *
 * @returns
 */
const uiLine = () => {
  logger.log('-'.repeat(50));
};

/**
 * Returns an object that aggregates what the terminal supports (eg. hyperlinks and color)
 *
 * @returns {object}
 */

const getTerminalUISupport = () => {
  return {
    hyperlinks: supportsHyperlinks.stdout,
    color: supportsColor.stdout.hasBasic,
  };
};

/**
 * Returns a hyperlink or link and description
 *
 * @param {string} linkText
 * @param {string} url
 * @param {object} options
 * @returns {string}
 */
const uiLink = (linkText, url) => {
  const terminalUISupport = getTerminalUISupport();
  if (terminalUISupport.hyperlinks) {
    const result = [
      '\u001B]8;;',
      url,
      '\u0007',
      linkText,
      '\u001B]8;;\u0007',
    ].join('');
    return terminalUISupport.color ? chalk.cyan(result) : result;
  } else {
    return terminalUISupport.color
      ? `${linkText}: ${chalk.reset.cyan(url)}`
      : `${linkText}: ${url}`;
  }
};

/**
 * Returns formatted account name and ID
 *
 * @param {number} accountId
 * @returns {string}
 */
const uiAccountDescription = accountId => {
  const account = getAccountConfig(accountId);
  return chalk.bold(
    account.name ? `${account.name} (${account.portalId})` : account.portalId
  );
};

const uiInfoSection = (title, logContent) => {
  uiLine();
  logger.log(chalk.bold(title));
  logger.log('');
  logContent();
  logger.log('');
  uiLine();
};

const uiFeatureHighlight = (commands, title) => {
  const i18nKey = 'cli.lib.ui.featureHighlight';

  uiInfoSection(title ? title : i18n(`${i18nKey}.defaultTitle`), () => {
    commands.forEach((c, i) => {
      const commandKey = `${i18nKey}.commandKeys.${c}`;
      const message = i18n(`${commandKey}.message`, {
        command: chalk.bold(i18n(`${commandKey}.command`)),
      });
      if (i !== 0) {
        logger.log('');
      }
      logger.log(message);
    });
  });
};

const uiBetaWarning = message => {
  const i18nKey = 'cli.lib.ui.betaWarning';

  logger.log(i18n(`${i18nKey}.header`));
  logger.log(chalk.reset.yellow(message));
  logger.log(i18n(`${i18nKey}.footer`));
};

module.exports = {
  uiAccountDescription,
  uiBetaWarning,
  uiFeatureHighlight,
  uiInfoSection,
  uiLine,
  uiLink,
};
