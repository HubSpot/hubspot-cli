const chalk = require('chalk');
const supportsHyperlinks = require('supports-hyperlinks');
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
 * Returns a hyperlink or link and description
 *
 * @param {string} linkText
 * @param {string} url
 * @param {object} options
 * @returns {string}
 */
const uiLink = (linkText, url, options = {}) => {
  if (supportsHyperlinks.stdout) {
    return ['\u001B]8;;', url, '\u0007', linkText, '\u001B]8;;\u0007'].join('');
  } else {
    return options.fallback ? `${linkText}: ${url}` : linkText;
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
