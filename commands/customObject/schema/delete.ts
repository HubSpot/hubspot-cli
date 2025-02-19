// @ts-nocheck
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { confirmPrompt, listPrompt } from '../../../lib/prompts/promptUtils';
import { fetchObjectSchemas } from '@hubspot/local-dev-lib/api/customObjects';

const { logger } = require('@hubspot/local-dev-lib/logger');
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

  trackCommandUsage('custom-object-schema-delete', null, derivedAccountId);

  let name;
  try {
    const {
      data: { results },
    } = await fetchObjectSchemas(derivedAccountId);
    const schemaNames = results?.map(({ name: schemaName }) => schemaName);
    name =
      providedName ||
      (await listPrompt(i18n(`${i18nKey}.selectSchema`), {
        choices: schemaNames,
      }));

    const shouldDelete =
      force ||
      (await confirmPrompt(i18n(`${i18nKey}.confirmDelete`, { name })));

    if (!shouldDelete) {
      logger.info(i18n(`${i18nKey}.deleteCancelled`, { name }));
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
