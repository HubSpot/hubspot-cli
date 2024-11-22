// @ts-nocheck
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { confirmPrompt, inputPrompt } from '../../../lib/prompts/promptUtils';

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
  const { name: providedName, force, derivedAccountId } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('custom-object-schema-delete', null, derivedAccountId);

  // TODO: Fetch the schemas and show a list.  Allow the user to select one.
  const name =
    providedName || (await inputPrompt(i18n(`${i18nKey}.selectSchema`)));
  const shouldDelete =
    force || (await confirmPrompt(i18n(`${i18nKey}.confirmDelete`, { name })));

  if (!shouldDelete) {
    logger.success(i18n(`${i18nKey}.deleteCancelled`, { name }));
    return process.exit(EXIT_CODES.SUCCESS);
  }

  try {
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
