const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { getAbsoluteFilePath } = require('@hubspot/cli-lib/path');
const {
  isFileValidJSON,
  loadAndValidateOptions,
} = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { addTestingOptions, getAccountId } = require('../../../lib/commonOpts');
const { getEnv, isConfigFlagEnabled } = require('@hubspot/cli-lib/');
const { ENVIRONMENTS, ConfigFlags } = require('@hubspot/cli-lib/lib/constants');
const { createSchema } = require('@hubspot/cli-lib/api/schema');
const {
  createSchema: createSchemaFromHubFile,
} = require('@hubspot/cli-lib/api/fileTransport');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { EXIT_CODES } = require('../../../lib/enums/exitCodes');

exports.command = 'create <definition>';
exports.describe = 'Create a custom object schema';

exports.handler = async options => {
  const { definition } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-create', null, accountId);

  const filePath = getAbsoluteFilePath(definition);
  if (!isFileValidJSON(filePath)) {
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    if (isConfigFlagEnabled(ConfigFlags.USE_CUSTOM_OBJECT_HUBFILE)) {
      await createSchemaFromHubFile(accountId, filePath);
      logger.success(`Your schema has been created in account "${accountId}"`);
    } else {
      const res = await createSchema(accountId, filePath);
      logger.success(
        `Schema can be viewed at ${getHubSpotWebsiteOrigin(
          getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
        )}/contacts/${accountId}/objects/${res.objectTypeId}`
      );
    }
  } catch (e) {
    logErrorInstance(e, { accountId });
    logger.error(`Schema creation from ${definition} failed`);
  }
};

exports.builder = yargs => {
  addTestingOptions(yargs, true);

  yargs.positional('definition', {
    describe: 'Local path to the JSON file containing the schema definition',
    type: 'string',
  });
};
