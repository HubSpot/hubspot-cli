const {
  lint,
  printHublValidationResult,
} = require('@hubspot/cms-lib/validate');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

const {
  addConfigOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { resolveLocalPath } = require('../lib/filesystem');
const { validatePortal } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
};

exports.command = 'lint <path>';
exports.describe = 'Lint a file or folder for HubL syntax';

exports.handler = async options => {
  const { path: lintPath } = options;

  await loadAndValidateOptions(options);

  const portalId = getPortalId(options);
  const localPath = resolveLocalPath(lintPath);
  const groupName = `Linting "${localPath}"`;

  trackCommandUsage('lint', {}, portalId);

  logger.group(groupName);
  let count = 0;
  try {
    await lint(portalId, localPath, result => {
      count += printHublValidationResult(result);
    });
  } catch (err) {
    logger.groupEnd(groupName);
    logErrorInstance(err, { portalId });
    process.exit(1);
  }
  logger.groupEnd(groupName);
  logger.log(`${count} issues found`);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  yargs.positional('path', {
    describe: 'Local folder to lint',
    type: 'string',
  });
  return yargs;
};
