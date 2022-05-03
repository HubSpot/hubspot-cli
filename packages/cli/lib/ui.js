const chalk = require('chalk');
const supportsHyperlinks = require('../lib/supportHyperlinks');
const supportsColor = require('../lib/supportsColor');
const { getAccountConfig } = require('@hubspot/cli-lib/lib/config');
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
      ? `${linkText}: ${chalk.cyan(url)}`
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

module.exports = {
  uiLine,
  uiLink,
  uiAccountDescription,
};
