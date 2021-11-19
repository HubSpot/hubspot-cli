const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { getAbsoluteFilePath } = require('@hubspot/cli-lib/path');
const {
  isFileValidJSON,
  loadAndValidateOptions,
} = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { addTestingOptions, getAccountId } = require('../../../lib/commonOpts');
const { ENVIRONMENTS, ConfigFlags } = require('@hubspot/cli-lib/lib/constants');
const { getEnv, isConfigFlagEnabled } = require('@hubspot/cli-lib');
const { updateSchema } = require('@hubspot/cli-lib/api/schema');
const {
  updateSchema: updateSchemaFromHubFile,
} = require('@hubspot/cli-lib/api/fileTransport');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { EXIT_CODES } = require('../../../lib/enums/exitCodes');

exports.command = 'update <name> <definition>';
exports.describe = 'Update an existing custom object schema';

exports.handler = async options => {
  const { definition, name } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-update', null, accountId);

  const filePath = getAbsoluteFilePath(definition);
  if (!isFileValidJSON(filePath)) {
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    if (isConfigFlagEnabled(ConfigFlags.USE_CUSTOM_OBJECT_HUBFILE)) {
      await updateSchemaFromHubFile(accountId, filePath);
      logger.success(`Your schema has been updated in account "${accountId}"`);
    } else {
      const res = await updateSchema(accountId, name, filePath);
      logger.success(
        `Schema can be viewed at ${getHubSpotWebsiteOrigin(
          getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
        )}/contacts/${accountId}/objects/${res.objectTypeId}`
      );
    }
  } catch (e) {
    logErrorInstance(e, { accountId });
    logger.error(`Schema update from ${definition} failed`);
  }
};

exports.builder = yargs => {
  addTestingOptions(yargs, true);

  yargs.positional('name', {
    describe: 'Name of the target schema',
    type: 'string',
  });

  yargs.positional('definition', {
    describe: 'Local path to the JSON file containing the schema definition',
    type: 'string',
  });
};
