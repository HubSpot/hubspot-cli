const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { getAbsoluteFilePath } = require('@hubspot/cms-lib/path');
const { validatePortal, isFileValidJSON } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const {
  addTestingOptions,
  setLogLevel,
  getPortalId,
} = require('../../../lib/commonOpts');
const { ENVIRONMENTS } = require('@hubspot/cms-lib/lib/constants');
const { getEnv } = require('@hubspot/cms-lib/lib/config');
const { logDebugInfo } = require('../../../lib/debugInfo');
const { updateSchema } = require('@hubspot/cms-lib/api/schema');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cms-lib/lib/urls');

exports.command = 'update <name> <definition>';
exports.describe = 'Update an existing custom object schema';

exports.handler = async options => {
  const { definition, name } = options;
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('custom-object-schema-update', null, portalId);

  const filePath = getAbsoluteFilePath(definition);
  if (!isFileValidJSON(filePath)) {
    process.exit(1);
  }

  try {
    const res = await updateSchema(portalId, name, filePath);
    logger.success(
      `Schema can be viewed at ${getHubSpotWebsiteOrigin(
        getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
      )}/contacts/${portalId}/objects/${res.objectTypeId}`
    );
  } catch (e) {
    logErrorInstance(e, { portalId });
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
