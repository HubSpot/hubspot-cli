const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');

const { loadAndValidateOptions } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { getAccountId } = require('../../../lib/commonOpts');
const { listSchemas } = require('@hubspot/cli-lib/schema');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.customObject.subcommands.schema.subcommands.list';

exports.command = 'list';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-list', null, accountId);

  try {
    await listSchemas(accountId);
  } catch (e) {
    logErrorInstance(e);
    logger.error(i18n(`${i18nKey}.errors.list`));
  }
};
