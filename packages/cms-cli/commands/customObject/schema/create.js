const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cms-lib/lib/urls');

const {
  validatePortal,
  getAbsoluteFilePath,
  isFileValidJSON,
} = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const {
  addTestingOptions,
  setLogLevel,
  getPortalId,
} = require('../../../lib/commonOpts');
const { ENVIRONMENTS } = require('@hubspot/cms-lib/lib/constants');
const { logDebugInfo } = require('../../../lib/debugInfo');
const { createSchema } = require('@hubspot/cms-lib/api/schema');

exports.command = 'create <definition>';
exports.describe = 'Create a Custom Object Schema';

exports.handler = async options => {
  const { definition } = options;
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('schema-create', null, portalId);

  const filePath = getAbsoluteFilePath(definition);
  if (!filePath || !isFileValidJSON(filePath)) {
    process.exit(1);
  }

  try {
    const res = await createSchema(portalId, filePath);
    logger.success(
      `Schema can be viewed at ${getHubSpotWebsiteOrigin(
        options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
      )}/contacts/${portalId}/objects/${res.objectTypeId}`
    );
  } catch (e) {
    logErrorInstance(e, { portalId });
    logger.error(`Schema creation from ${definition} failed`);
  }
};

exports.builder = yargs => {
  addTestingOptions(yargs, true);

  yargs.positional('definition', {
    describe: 'local path to JSON file containing schema definition',
    type: 'string',
  });
};
