const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { deleteTable } = require('@hubspot/cli-lib/api/hubdb');
const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');

exports.command = 'delete <tableId>';
exports.describe = 'delete a HubDB table';

exports.handler = async options => {
  const { tableId } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-delete', {}, accountId);

  try {
    await deleteTable(accountId, tableId);
    logger.log(`The table ${tableId} was deleted from ${accountId}`);
  } catch (e) {
    logger.error(`Deleting the table ${tableId} failed`);
    logErrorInstance(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs, true);
  addConfigOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('tableId', {
    describe: 'HubDB Table ID',
    type: 'string',
  });
};
