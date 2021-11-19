const path = require('path');

const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { getCwd } = require('@hubspot/cli-lib/path');
const { createHubDbTable } = require('@hubspot/cli-lib/hubdb');

const {
  isFileValidJSON,
  loadAndValidateOptions,
} = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'create <src>';
exports.describe = 'Create a HubDB table';

exports.handler = async options => {
  const { src } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-create', {}, accountId);

  try {
    const filePath = path.resolve(getCwd(), src);
    if (!isFileValidJSON(filePath)) {
      process.exit(EXIT_CODES.ERROR);
    }

    const table = await createHubDbTable(
      accountId,
      path.resolve(getCwd(), src)
    );
    logger.log(
      `The table ${table.tableId} was created in ${accountId} with ${table.rowCount} rows`
    );
  } catch (e) {
    logger.error(`Creating the table at "${src}" failed`);
    logErrorInstance(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs, true);
  addConfigOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe: 'local path to file used for import',
    type: 'string',
  });
};
