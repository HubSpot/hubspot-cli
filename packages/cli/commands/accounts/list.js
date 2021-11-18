const { logger } = require('@hubspot/cli-lib/logger');
const { getConfig, getConfigPath } = require('@hubspot/cli-lib/lib/config');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/cli-lib/lib/table');

const {
  addConfigOptions,
  addAccountOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');

exports.command = 'list';
exports.describe = 'List names of accounts defined in config';

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('accounts-list', {}, accountId);

  const config = getConfig();
  const configPath = getConfigPath();
  const portalData = config.portals.map(portal => {
    return [portal.name, portal.portalId, portal.authType];
  });
  portalData.unshift(getTableHeader(['Name', 'Account ID', 'Auth Type']));

  logger.log(`Config path: ${configPath}`);
  logger.log('Default account: ', config.defaultPortal);
  logger.log('Accounts:');
  logger.log(getTableContents(portalData, { border: { bodyLeft: '  ' } }));
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.example([['$0 accounts list']]);

  return yargs;
};
