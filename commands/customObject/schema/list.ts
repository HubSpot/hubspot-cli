// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../../lib/errorHandlers/index');

const { loadAndValidateOptions } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { listSchemas } = require('../../../lib/schema');
const { i18n } = require('../../../lib/lang');

const i18nKey = 'commands.customObject.subcommands.schema.subcommands.list';

exports.command = 'list';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { account } = options;

  trackCommandUsage('custom-object-schema-list', null, account);

  try {
    await listSchemas(account);
  } catch (e) {
    logError(e);
    logger.error(i18n(`${i18nKey}.errors.list`));
  }
};
