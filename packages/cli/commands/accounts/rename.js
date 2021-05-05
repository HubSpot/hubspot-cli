const { logger } = require('@hubspot/cli-lib/logger');
const { renameAccount } = require('@hubspot/cli-lib/lib/config');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');

const {
  addConfigOptions,
  addAccountOptions,
  getAccountId,
  setLogLevel,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validateAccount } = require('../../lib/validation');

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

exports.command = 'rename <accountName> <newName>';
exports.describe = 'Rename account in config';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { accountName, newName } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('accounts-rename', {}, accountId);

  await renameAccount(accountName, newName);

  return logger.log(`Account ${accountName} renamed to ${newName}`);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.positional('accountName', {
    describe: 'Name of account to be renamed.',
    type: 'string',
  });
  yargs.positional('newName', {
    describe: 'New name for account.',
    type: 'string',
  });

  yargs.example([['$0 accounts rename myExistingPortalName myNewPortalName']]);

  return yargs;
};
