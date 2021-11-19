const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { getAbsoluteFilePath } = require('@hubspot/cli-lib/path');
const {
  isFileValidJSON,
  loadAndValidateOptions,
} = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { getAccountId } = require('../../lib/commonOpts');
const { batchCreateObjects } = require('@hubspot/cli-lib/api/customObject');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'create <name> <definition>';
exports.describe = 'Create custom object instances';

exports.handler = async options => {
  const { definition, name } = options;

  await loadAndValidateOptions(options);

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
