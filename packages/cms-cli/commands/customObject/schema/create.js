const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { getAbsoluteFilePath } = require('@hubspot/cms-lib/path');
const { validateAccount, isFileValidJSON } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const {
  addTestingOptions,
  setLogLevel,
  getAccountId,
} = require('../../../lib/commonOpts');
const { getEnv } = require('@hubspot/cms-lib/lib/config');
const { ENVIRONMENTS } = require('@hubspot/cms-lib/lib/constants');
const { logDebugInfo } = require('../../../lib/debugInfo');
const { createSchema } = require('@hubspot/cms-lib/api/schema');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cms-lib/lib/urls');

exports.command = 'create <definition>';
exports.describe = 'Create a custom object schema';

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
    const res = await createSchema(accountId, filePath);
    logger.success(
      `Schema can be viewed at ${getHubSpotWebsiteOrigin(
        getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
      )}/contacts/${accountId}/objects/${res.objectTypeId}`
    );
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
