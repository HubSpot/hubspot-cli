// @ts-nocheck
import { fetchObjectSchemas } from '@hubspot/local-dev-lib/api/customObjects';
import { listPrompt } from '../../../lib/prompts/promptUtils';

const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../../lib/errorHandlers/index');
const { getAbsoluteFilePath } = require('@hubspot/local-dev-lib/path');
const {
  ENVIRONMENTS,
} = require('@hubspot/local-dev-lib/constants/environments');
const { checkAndConvertToJson } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { addTestingOptions } = require('../../../lib/commonOpts');
const { CONFIG_FLAGS } = require('../../../lib/constants');
const {
  getEnv,
  isConfigFlagEnabled,
} = require('@hubspot/local-dev-lib/config');
const {
  updateObjectSchema,
} = require('@hubspot/local-dev-lib/api/customObjects');
const {
  updateSchema: updateSchemaFromHubFile,
} = require('@hubspot/local-dev-lib/api/fileTransport');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { i18n } = require('../../../lib/lang');

const i18nKey = 'commands.customObject.subcommands.schema.subcommands.update';
const { EXIT_CODES } = require('../../../lib/enums/exitCodes');

exports.command = 'update [name]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { path, name: providedName, derivedAccountId } = options;

  trackCommandUsage('custom-object-schema-update', null, derivedAccountId);

  const filePath = getAbsoluteFilePath(path);
  const schemaJson = checkAndConvertToJson(filePath);
  if (!schemaJson) {
    process.exit(EXIT_CODES.ERROR);
  }

  let name = providedName;
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
    if (isConfigFlagEnabled(CONFIG_FLAGS.USE_CUSTOM_OBJECT_HUBFILE)) {
      await updateSchemaFromHubFile(derivedAccountId, filePath);
      logger.success(
        i18n(`${i18nKey}.success.update`, {
          accountId: derivedAccountId,
        })
      );
    } else {
      const { data } = await updateObjectSchema(
        derivedAccountId,
        name,
        schemaJson
      );
      logger.success(
        i18n(`${i18nKey}.success.viewAtUrl`, {
          url: `${getHubSpotWebsiteOrigin(
            getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
          )}/contacts/${derivedAccountId}/objects/${data.objectTypeId}`,
        })
      );
    }
  } catch (e) {
    logError(e, { accountId: derivedAccountId });
    logger.error(
      i18n(`${i18nKey}.errors.update`, {
        definition: path,
      })
    );
  }
};

exports.builder = yargs => {
  addTestingOptions(yargs);

  yargs
    .positional('name', {
      describe: i18n(`${i18nKey}.positionals.name.describe`),
      type: 'string',
    })
    .option('path', {
      describe: i18n(`${i18nKey}.options.path.describe`),
      type: 'string',
      required: true,
    });
};
