// @ts-nocheck
import { EXIT_CODES } from '../../../lib/enums/exitCodes';

const { logger } = require('@hubspot/local-dev-lib/logger');
const { loadAndValidateOptions } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const {
  deleteObjectSchema,
} = require('@hubspot/local-dev-lib/api/customObjects');
const { i18n } = require('../../../lib/lang');
const { logError } = require('../../../lib/errorHandlers');

const i18nKey = 'commands.customObject.subcommands.schema.subcommands.delete';

exports.command = 'delete [name]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { name, force, derivedAccountId } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('custom-object-schema-delete', null, derivedAccountId);

  try {
    if (!name) {
      // TODO: fetch all the schemas and prompt for the name
    }
    const shouldDelete = force; // TODO: prompt for confirmation

    if (!shouldDelete) {
      logger.success('Delete cancelled');
      return process.exit(EXIT_CODES.SUCCESS);
    }

    await deleteObjectSchema(derivedAccountId, name);
    logger.success(
      i18n(`${i18nKey}.success.delete`, {
        name,
      })
    );
  } catch (e) {
    logError(e);
    logger.error(
      i18n(`${i18nKey}.errors.delete`, {
        name,
      })
    );
  }
};

exports.builder = yargs => {
  yargs
    .example([
      ['$0 schema delete schemaName', i18n(`${i18nKey}.examples.default`)],
    ])
    .positional('name', {
      describe: i18n(`${i18nKey}.positionals.name.describe`),
      type: 'string',
    })
    .option('force', {
      describe: i18n(`${i18nKey}.options.force.describe`),
      type: 'boolean',
    });
};
