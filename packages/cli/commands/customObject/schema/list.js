const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');

const { loadAndValidateOptions } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { getAccountId } = require('../../../lib/commonOpts');
const { listSchemas } = require('@hubspot/cli-lib/schema');

exports.command = 'list';
exports.describe = 'List schemas available on your account';

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-list', null, accountId);

  try {
    await listSchemas(accountId);
  } catch (e) {
    logErrorInstance(e);
    logger.error(`Unable to list schemas`);
  }
};
