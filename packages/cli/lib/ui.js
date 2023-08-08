const process = require('process');
const chalk = require('chalk');
const supportsHyperlinks = require('../lib/supportHyperlinks');
const supportsColor = require('../lib/supportsColor');
const { getAccountConfig } = require('@hubspot/cli-lib/lib/config');
const { i18n } = require('./lang');
const { logger } = require('@hubspot/cli-lib/logger');

const UI_COLORS = {
  SORBET: '#FF8F59',
  MARIGOLD: '#f5c26b',
  MARIGOLD_DARK: '#dbae60',
};

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
const uiLink = (linkText, url, { inSpinnies = false } = {}) => {
  const terminalUISupport = getTerminalUISupport();
  const encodedUrl = encodeURI(url);
  if (terminalUISupport.hyperlinks) {
    const CLOSE_SEQUENCE = '\u001B]8;;\u0007';
    const result = [
      '\u001B]8;;',
      encodedUrl,
      '\u0007',
      linkText,
      CLOSE_SEQUENCE,
    ].join('');

    // Required b/c spinnies will automatically line-break long lines. "indent" is added to account for indented spinnies
    // See https://github.com/jbcarpanelli/spinnies/blob/d672dedcab8c8ce0f6de0bb26ca5582bf602afd7/utils.js#L68-L74
    const indent = 5;
    const columns =
      (process.stderr.columns || 95) - CLOSE_SEQUENCE.length - indent;
    const validLength = !inSpinnies || result.length < columns;

    if (validLength) {
      return terminalUISupport.color ? chalk.cyan(result) : result;
    }
  }

  return terminalUISupport.color
    ? `${linkText}: ${chalk.reset.cyan(encodedUrl)}`
    : `${linkText}: ${encodedUrl}`;
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

const uiCommandReference = command => {
  return chalk.bold(chalk.hex(UI_COLORS.MARIGOLD_DARK)(`\`${command}\``));
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

const uiBetaMessage = message => {
  const i18nKey = 'cli.lib.ui';

  logger.log(chalk.hex(UI_COLORS.SORBET)(i18n(`${i18nKey}.betaTag`)), message);
};

const uiBetaWarning = logMessage => {
  const i18nKey = 'cli.lib.ui.betaWarning';

  logger.log(i18n(`${i18nKey}.header`));
  logMessage();
  logger.log(i18n(`${i18nKey}.footer`));
};

module.exports = {
  UI_COLORS,
  uiAccountDescription,
  uiCommandReference,
  uiBetaMessage,
  uiBetaWarning,
  uiFeatureHighlight,
  uiInfoSection,
  uiLine,
  uiLink,
};
