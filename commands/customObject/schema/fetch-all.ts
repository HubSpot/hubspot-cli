// @ts-nocheck
import { inputPrompt } from '../../../lib/prompts/promptUtils';

const { logger } = require('@hubspot/local-dev-lib/logger');
const { loadAndValidateOptions } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const {
  downloadSchemas,
  getResolvedPath,
} = require('@hubspot/local-dev-lib/customObjects');
const { i18n } = require('../../../lib/lang');
const { logSchemas } = require('../../../lib/schema');
const { logError } = require('../../../lib/errorHandlers');

const i18nKey = 'commands.customObject.subcommands.schema.subcommands.fetchAll';

exports.command = 'fetch-all [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { derivedAccountId, dest: providedDest } = options;

  trackCommandUsage('custom-object-schema-fetch-all', null, derivedAccountId);

  try {
    const dest =
      providedDest || (await inputPrompt(i18n(`${i18nKey}.inputDest`)));
    const schemas = await downloadSchemas(derivedAccountId, dest);
    logSchemas(schemas);
    logger.success(
      i18n(`${i18nKey}.success.fetch`, {
        path: getResolvedPath(dest),
      })
    );
  } catch (e) {
    logError(e);
    logger.error(i18n(`${i18nKey}.errors.fetch`));
  }
};

exports.builder = yargs => {
  yargs
    .example([
      [
        '$0 custom-object schema fetch-all',
        i18n(`${i18nKey}.examples.default`),
      ],
      [
        '$0 custom-object schema fetch-all my/folder',
        i18n(`${i18nKey}.examples.specifyPath`),
      ],
    ])
    .positional('dest', {
      describe: i18n(`${i18nKey}.positionals.dest.describe`),
      type: 'string',
    });
};
