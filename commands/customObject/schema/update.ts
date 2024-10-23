// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../../lib/errorHandlers/index');
const { getAbsoluteFilePath } = require('@hubspot/local-dev-lib/path');
const {
  ENVIRONMENTS,
} = require('@hubspot/local-dev-lib/constants/environments');
const {
  checkAndConvertToJson,
  loadAndValidateOptions,
} = require('../../../lib/validation');
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

exports.command = 'update <name> <definition>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { definition, name, account } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('custom-object-schema-update', null, account);

  const filePath = getAbsoluteFilePath(definition);
  const schemaJson = checkAndConvertToJson(filePath);
  if (!schemaJson) {
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    if (isConfigFlagEnabled(CONFIG_FLAGS.USE_CUSTOM_OBJECT_HUBFILE)) {
      await updateSchemaFromHubFile(account, filePath);
      logger.success(
        i18n(`${i18nKey}.success.update`, {
          accountId: account,
        })
      );
    } else {
      const { data } = await updateObjectSchema(account, name, schemaJson);
      logger.success(
        i18n(`${i18nKey}.success.viewAtUrl`, {
          url: `${getHubSpotWebsiteOrigin(
            getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
          )}/contacts/${account}/objects/${data.objectTypeId}`,
        })
      );
    }
  } catch (e) {
    logError(e, { accountId: account });
    logger.error(
      i18n(`${i18nKey}.errors.update`, {
        definition,
      })
    );
  }
};

exports.builder = yargs => {
  addTestingOptions(yargs);

  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });

  yargs.positional('definition', {
    describe: i18n(`${i18nKey}.positionals.definition.describe`),
    type: 'string',
  });
};
