const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cms-lib/lib/urls');
const { getCwd } = require('@hubspot/cms-lib/path');

const {
  validatePortal,
  getAbsoluteFilePath,
  isFileValidJSON,
} = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  addConfigOptions,
  addPortalOptions,
  addTestingOptions,
  setLogLevel,
  getPortalId,
} = require('../../lib/commonOpts');
const { ENVIRONMENTS } = require('@hubspot/cms-lib/lib/constants');
const { shouldIgnoreFile } = require('@hubspot/cms-lib/ignoreRules');
const { logDebugInfo } = require('../../lib/debugInfo');
const { createSchema } = require('@hubspot/cms-lib/api/schema');

const action = async (args, options) => {
  const { definition } = args;
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

  if (shouldIgnoreFile(filePath, getCwd())) {
    logger.error(
      `The file "${definition}" is being ignored via an .hsignore rule`
    );
    return;
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

exports.command = 'create <definition>';
exports.describe = 'Create a Custom Object Schema';
exports.handler = async argv => action({ definition: argv.definition }, argv);
exports.builder = yargs => {
  addPortalOptions(yargs, true);
  addConfigOptions(yargs, true);
  addTestingOptions(yargs, true);

  yargs.positional('definition', {
    describe: 'local path to JSON file containing schema definition',
    type: 'string',
    demand: true,
  });
};
