const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const { deployApp } = require('@hubspot/cli-lib/api/appPipeline');

const {
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validateAccount } = require('../../lib/validation');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

exports.command = 'deploy <path>';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: appPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('app-deploy', {}, accountId);

  let result;

  try {
    result = await deployApp(accountId, appPath);
  } catch (error) {
    logApiErrorInstance(
      error,
      new ApiErrorContext({
        accountId,
        request: appPath,
      })
    );
    process.exit(1);
  }

  logger.log(`Deploy task "${result.id}" has been started.`);
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to app folder',
    type: 'string',
  });

  yargs.example([['$0 app deploy /example-app', 'Build and deploy app']]);

  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
