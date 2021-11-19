const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');

const { loadAndValidateOptions } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { getAccountId } = require('../../../lib/commonOpts');
const { deleteSchema } = require('@hubspot/cli-lib/api/schema');

exports.command = 'delete <name>';
exports.describe = 'Delete a custom object schema';

exports.handler = async options => {
  let { name } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-delete', null, accountId);

  try {
    await deleteSchema(accountId, name);
    logger.success(`Successfully initiated deletion of ${name}`);
  } catch (e) {
    logErrorInstance(e);
    logger.error(`Unable to delete ${name}`);
  }
};

exports.builder = yargs => {
  yargs.example([
    ['$0 schema delete schemaName', 'Delete `schemaName` schema'],
  ]);

  yargs.positional('name', {
    describe: 'Name of the target schema',
    type: 'string',
  });
};
