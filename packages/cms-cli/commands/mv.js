const { moveFile } = require('@hubspot/cms-lib/api/fileMapper');
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
const { isFolder } = require('@hubspot/cms-lib/path');

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

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
};

const getCorrectedDestPath = (srcPath, destPath) => {
  if (!isFolder(srcPath)) {
    return destPath;
  }

  // Makes sure that nested folders are moved independently
  return `${destPath}/${srcPath.split('/').pop()}`;
};

exports.command = 'mv <srcPath> <destPath>';
exports.describe = 'Move a remote file or folder in HubSpot';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { srcPath, destPath } = options;
  const portalId = getPortalId(options);

  trackCommandUsage('mv', {}, portalId);

  try {
    await moveFile(portalId, srcPath, getCorrectedDestPath(srcPath, destPath));
    logger.success(`Moved "${srcPath}" to "${destPath}" in portal ${portalId}`);
  } catch (error) {
    logger.error(
      `Moving "${srcPath}" to "${destPath}" in portal ${portalId} failed`
    );
    logApiErrorInstance(
      error,
      new ApiErrorContext({
        portalId,
        srcPath,
        destPath,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  yargs.positional('srcPath', {
    describe: 'Remote hubspot path',
    type: 'string',
  });
  yargs.positional('destPath', {
    describe: 'Remote hubspot path',
    type: 'string',
  });
  return yargs;
};
