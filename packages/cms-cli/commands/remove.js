const { deleteFile } = require('@hubspot/cms-lib/api/fileMapper');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');

const {
  addConfigOptions,
  addPortalOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getPortalId,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { validatePortal } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');

exports.command = 'remove <path>';
exports.describe = 'Delete a file or folder from HubSpot';

exports.handler = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath, path: hsPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }

  const portalId = getPortalId(options);

  trackCommandUsage('remove', {}, portalId);

  try {
    await deleteFile(portalId, hsPath);
    logger.log(`Deleted "${hsPath}" from portal ${portalId}`);
  } catch (error) {
    logger.error(`Deleting "${hsPath}" from portal ${portalId} failed`);
    logApiErrorInstance(
      error,
      new ApiErrorContext({
        portalId,
        request: hsPath,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  yargs.positional('path', {
    describe: 'Remote hubspot path',
    type: 'string',
  });
  return yargs;
};
