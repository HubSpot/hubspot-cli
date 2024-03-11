const { logger } = require('@hubspot/local-dev-lib/logger');
const { logApiErrorInstance } = require('../../../lib/errorHandlers/apiErrors');
const { getAbsoluteFilePath } = require('@hubspot/local-dev-lib/path');
const {
  ENVIRONMENTS,
} = require('@hubspot/local-dev-lib/constants/environments');
const {
  checkAndConvertToJson,
  loadAndValidateOptions,
} = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { addTestingOptions, getAccountId } = require('../../../lib/commonOpts');
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

const i18nKey =
  'cli.commands.customObject.subcommands.schema.subcommands.update';
const { EXIT_CODES } = require('../../../lib/enums/exitCodes');

exports.command = 'update <name> <definition>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { definition, name } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-update', null, accountId);

  const filePath = getAbsoluteFilePath(definition);
  const schemaJson = checkAndConvertToJson(filePath);
  if (!schemaJson) {
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    if (isConfigFlagEnabled(CONFIG_FLAGS.USE_CUSTOM_OBJECT_HUBFILE)) {
      await updateSchemaFromHubFile(accountId, filePath);
      logger.success(
        i18n(`${i18nKey}.success.update`, {
          accountId,
        })
      );
    } else {
      const res = await updateObjectSchema(accountId, name, schemaJson);
      logger.success(
        i18n(`${i18nKey}.success.viewAtUrl`, {
          url: `${getHubSpotWebsiteOrigin(
            getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
          )}/contacts/${accountId}/objects/${res.objectTypeId}`,
        })
      );
    }
  } catch (e) {
    logApiErrorInstance(e, { accountId });
    logger.error(
      i18n(`${i18nKey}.errors.update`, {
        definition,
      })
    );
  }
};

exports.builder = yargs => {
  addTestingOptions(yargs, true);

  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });

  yargs.positional('definition', {
    describe: i18n(`${i18nKey}.positionals.definition.describe`),
    type: 'string',
  });
};
