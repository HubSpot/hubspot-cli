// @ts-nocheck
import { inputPrompt, listPrompt } from '../../../lib/prompts/promptUtils';
import { fetchObjectSchemas } from '@hubspot/local-dev-lib/api/customObjects';

const path = require('path');
const { isConfigFlagEnabled } = require('@hubspot/local-dev-lib/config');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { CONFIG_FLAGS } = require('../../../lib/constants');
const {
  downloadSchema,
  getResolvedPath,
} = require('@hubspot/local-dev-lib/customObjects');
const { fetchSchema } = require('@hubspot/local-dev-lib/api/fileTransport');
const { getCwd } = require('@hubspot/local-dev-lib/path');

const { trackCommandUsage } = require('../../../lib/usageTracking');
const { i18n } = require('../../../lib/lang');
const { logError } = require('../../../lib/errorHandlers');

const i18nKey = 'commands.customObject.subcommands.schema.subcommands.fetch';

exports.command = 'fetch [name] [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { name: providedName, dest: providedDest, derivedAccountId } = options;

  trackCommandUsage('custom-object-schema-fetch', null, derivedAccountId);
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

    const dest =
      providedDest || (await inputPrompt(i18n(`${i18nKey}.inputDest`)));

    if (isConfigFlagEnabled(CONFIG_FLAGS.USE_CUSTOM_OBJECT_HUBFILE)) {
      const fullpath = path.resolve(getCwd(), dest);
      await fetchSchema(derivedAccountId, name, fullpath);
      logger.success(
        i18n(`${i18nKey}.success.save`, {
          name,
          path: fullpath,
        })
      );
    } else {
      await downloadSchema(derivedAccountId, name, dest);
      logger.success(
        i18n(`${i18nKey}.success.savedToPath`, {
          path: getResolvedPath(dest, name),
        })
      );
    }
  } catch (e) {
    logError(e);
    logger.error(
      i18n(`${i18nKey}.errors.fetch`, {
        name,
      })
    );
  }
};

exports.builder = yargs => {
  yargs
    .example([
      [
        '$0 custom-object schema fetch schemaName',
        i18n(`${i18nKey}.examples.default`),
      ],
      [
        '$0 custom-object schema fetch schemaName my/folder',
        i18n(`${i18nKey}.examples.specifyPath`),
      ],
    ])
    .positional('name', {
      describe: i18n(`${i18nKey}.positionals.name.describe`),
      type: 'string',
    })
    .positional('dest', {
      describe: i18n(`${i18nKey}.positionals.dest.describe`),
      type: 'string',
    });
};
