const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { getAbsoluteFilePath } = require('@hubspot/cli-lib/path');
const { validateAccount, isFileValidJSON } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const {
  addTestingOptions,
  setLogLevel,
  getAccountId,
} = require('../../../lib/commonOpts');
const { getEnv, isConfigFlagEnabled } = require('@hubspot/cli-lib/');
const { ENVIRONMENTS, ConfigFlags } = require('@hubspot/cli-lib/lib/constants');
const { logDebugInfo } = require('../../../lib/debugInfo');
const { createSchema } = require('@hubspot/cli-lib/api/schema');
const {
  createSchema: createSchemaFromHubFile,
} = require('@hubspot/cli-lib/api/fileTransport');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey =
  'cli.commands.customObject.subcommands.schema.subcommands.create';

exports.command = 'create <definition>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { definition } = options;
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-create', null, accountId);

  const filePath = getAbsoluteFilePath(definition);
  if (!isFileValidJSON(filePath)) {
    process.exit(1);
  }

  try {
    if (isConfigFlagEnabled(ConfigFlags.USE_CUSTOM_OBJECT_HUBFILE)) {
      await createSchemaFromHubFile(accountId, filePath);
      logger.success(
        i18n(`${i18nKey}.success.schemaCreated`, {
          accountId,
        })
      );
    } else {
      const res = await createSchema(accountId, filePath);
      logger.success(
        i18n(`${i18nKey}.success.schemaViewable`, {
          url: `${getHubSpotWebsiteOrigin(
            getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
          )}/contacts/${accountId}/objects/${res.objectTypeId}`,
        })
      );
    }
  } catch (e) {
    logErrorInstance(e, { accountId });
    logger.error(
      i18n(`${i18nKey}.errors.creationFailed`, {
        definition,
      })
    );
  }
};

exports.builder = yargs => {
  addTestingOptions(yargs, true);

  yargs.positional('definition', {
    describe: i18n(`${i18nKey}.positionals.definition.describe`),
    type: 'string',
  });
};
