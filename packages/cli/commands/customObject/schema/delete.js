const { logger } = require('@hubspot/local-dev-lib/logger');
const { logApiErrorInstance } = require('../../../lib/errorHandlers/apiErrors');

const { loadAndValidateOptions } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { getAccountId } = require('../../../lib/commonOpts');
const {
  deleteObjectSchema,
} = require('@hubspot/local-dev-lib/api/customObjects');
const { i18n } = require('../../../lib/lang');

const i18nKey = 'commands.customObject.subcommands.schema.subcommands.delete';

exports.command = 'delete <name>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  let { name } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-delete', null, accountId);

  try {
    await deleteObjectSchema(accountId, name);
    logger.success(
      i18n(`${i18nKey}.success.delete`, {
        name,
      })
    );
  } catch (e) {
    logApiErrorInstance(e);
    logger.error(
      i18n(`${i18nKey}.errors.delete`, {
        name,
      })
    );
  }
};

exports.builder = yargs => {
  yargs.example([
    ['$0 schema delete schemaName', i18n(`${i18nKey}.examples.default`)],
  ]);

  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });
};
