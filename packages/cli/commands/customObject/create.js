const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { getAbsoluteFilePath } = require('@hubspot/cli-lib/path');
const { validateAccount, isFileValidJSON } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { setLogLevel, getAccountId } = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { batchCreateObjects } = require('@hubspot/cli-lib/api/customObject');
const { EXIT_CODES } = require('../../lib/exitCodes');

exports.command = 'create <name> <definition>';
exports.describe = 'Create custom object instances';

exports.handler = async options => {
  const { definition, name } = options;
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(EXIT_CODES.ERROR);
  }
  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-batch-create', null, accountId);

  const filePath = getAbsoluteFilePath(definition);
  if (!isFileValidJSON(filePath)) {
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await batchCreateObjects(accountId, name, filePath);
    logger.success(`Objects created`);
  } catch (e) {
    logErrorInstance(e, { accountId });
    logger.error(`Object creation from ${definition} failed`);
  }
};

exports.builder = yargs => {
  yargs.positional('name', {
    describe: 'Schema name to add the object instance to',
    type: 'string',
  });

  yargs.positional('definition', {
    describe:
      'Local path to the JSON file containing an array of object definitions',
    type: 'string',
  });
};
