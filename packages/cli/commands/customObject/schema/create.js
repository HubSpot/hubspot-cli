const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../../lib/errorHandlers/index');
const { getAbsoluteFilePath } = require('@hubspot/local-dev-lib/path');
const {
  checkAndConvertToJson,
  loadAndValidateOptions,
} = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { addTestingOptions, getAccountId } = require('../../../lib/commonOpts');
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

exports.command = 'create <definition>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { definition } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-create', null, accountId);

  const filePath = getAbsoluteFilePath(definition);
  const schemaJson = checkAndConvertToJson(filePath);
  if (!schemaJson) {
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    if (isConfigFlagEnabled(CONFIG_FLAGS.USE_CUSTOM_OBJECT_HUBFILE)) {
      await createSchemaFromHubFile(accountId, filePath);
      logger.success(
        i18n(`${i18nKey}.success.schemaCreated`, {
          accountId,
        })
      );
    } else {
      const { data } = await createObjectSchema(accountId, schemaJson);
      logger.success(
        i18n(`${i18nKey}.success.schemaViewable`, {
          url: `${getHubSpotWebsiteOrigin(
            getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
          )}/contacts/${accountId}/objects/${data.objectTypeId}`,
        })
      );
    }
  } catch (e) {
    logError(e, { accountId });
    logger.error(
      i18n(`${i18nKey}.errors.creationFailed`, {
        definition,
      })
    );
  }
};

exports.builder = yargs => {
  addTestingOptions(yargs);

  yargs.positional('definition', {
    describe: i18n(`${i18nKey}.positionals.definition.describe`),
    type: 'string',
  });
};
