const { logger } = require('@hubspot/cli-lib/logger');
const { renameAccount } = require('@hubspot/cli-lib/lib/config');

const {
  addConfigOptions,
  addAccountOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');

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
