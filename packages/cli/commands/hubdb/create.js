const path = require('path');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { getCwd } = require('@hubspot/cli-lib/path');
const { createHubDbTable } = require('@hubspot/cli-lib/hubdb');

const { validateAccount, isFileValidJSON } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { EXIT_CODES } = require('../../lib/exitCodes');

exports.command = 'create <src>';
exports.describe = 'Create a HubDB table';

exports.handler = async options => {
  const { config: configPath, src } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(EXIT_CODES.ERROR);
  }
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
