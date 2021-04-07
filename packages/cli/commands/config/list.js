const { logger } = require('@hubspot/cli-lib/logger');
const { getConfig } = require('@hubspot/cli-lib/lib/config');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
  setLogLevel,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validateAccount } = require('../../lib/validation');
const { getTableContents, getTableHeader } = require('../../lib/table');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

exports.command = 'list';
exports.describe = 'List names of accounts defined in config';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('config-list', {}, accountId);

  const config = getConfig();
  const portalData = config.portals.reduce((acc, portal) => {
    acc.push([portal.name, portal.portalId, portal.authType]);

    return acc;
  }, []);
  portalData.unshift(getTableHeader(['Name', 'Account ID', 'Auth Type']));

  logger.log(getTableContents(portalData));
  logger.log('Default Account: ', config.defaultPortal);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.example([['$0 config list']]);

  return yargs;
};
