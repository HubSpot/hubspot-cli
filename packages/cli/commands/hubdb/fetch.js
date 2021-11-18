const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { downloadHubDbTable } = require('@hubspot/cli-lib/hubdb');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');

exports.command = 'fetch <tableId> [dest]';
exports.describe = 'fetch a HubDB table';

exports.handler = async options => {
  const { tableId, dest } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-fetch', {}, accountId);

  try {
    const { filePath } = await downloadHubDbTable(accountId, tableId, dest);

    logger.log(`Downloaded HubDB table ${tableId} to ${filePath}`);
  } catch (e) {
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

  yargs.positional('dest', {
    describe: 'Local destination folder to fetch table to',
    type: 'string',
  });
};
