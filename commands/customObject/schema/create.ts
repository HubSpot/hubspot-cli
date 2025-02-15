// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../../lib/errorHandlers/index');
const { getAbsoluteFilePath } = require('@hubspot/local-dev-lib/path');
const { checkAndConvertToJson } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { addTestingOptions } = require('../../../lib/commonOpts');
const {
  getEnv,
  isConfigFlagEnabled,
} = require('@hubspot/local-dev-lib/config');
const {
  ENVIRONMENTS,
} = require('@hubspot/local-dev-lib/constants/environments');
const { CONFIG_FLAGS } = require('../../../lib/constants');
const {
  createObjectSchema,
} = require('@hubspot/local-dev-lib/api/customObjects');
const {
  createSchema: createSchemaFromHubFile,
} = require('@hubspot/local-dev-lib/api/fileTransport');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { i18n } = require('../../../lib/lang');

const i18nKey = 'commands.customObject.subcommands.schema.subcommands.create';
const { EXIT_CODES } = require('../../../lib/enums/exitCodes');

exports.command = 'create';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { path, derivedAccountId } = options;

  trackCommandUsage('custom-object-schema-create', null, derivedAccountId);

  const filePath = getAbsoluteFilePath(path);
  const schemaJson = checkAndConvertToJson(filePath);
  if (!schemaJson) {
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    if (isConfigFlagEnabled(CONFIG_FLAGS.USE_CUSTOM_OBJECT_HUBFILE)) {
      await createSchemaFromHubFile(derivedAccountId, filePath);
      logger.success(
        i18n(`${i18nKey}.success.schemaCreated`, {
          accountId: derivedAccountId,
        })
      );
    } else {
      const { data } = await createObjectSchema(derivedAccountId, schemaJson);
      logger.success(
        i18n(`${i18nKey}.success.schemaViewable`, {
          url: `${getHubSpotWebsiteOrigin(
            getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
          )}/contacts/${derivedAccountId}/objects/${data.objectTypeId}`,
        })
      );
    }
  } catch (e) {
    logError(e, { accountId: derivedAccountId });
    logger.error(
      i18n(`${i18nKey}.errors.creationFailed`, {
        definition: path,
      })
    );
  }
};

exports.builder = yargs => {
  addTestingOptions(yargs);

  yargs.option('path', {
    describe: i18n(`${i18nKey}.options.definition.describe`),
    type: 'string',
    required: true,
  });
};
