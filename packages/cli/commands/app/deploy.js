const ora = require('ora');
const {
  getEnv,
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { logger } = require('@hubspot/cli-lib/logger');
const { deployAppSync } = require('@hubspot/cli-lib/api/appPipeline');

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

  const spinner = ora(`Building "${appPath}" in account ${accountId}`).start();
  try {
    result = await deployAppSync(accountId, appPath);
  } catch (error) {
    spinner.error();
    logApiErrorInstance(
      error,
      new ApiErrorContext({
        accountId,
        request: appPath,
      })
    );
    process.exit(1);
  }

  spinner.succeed();
  logger.success(
    `You app has been built and deployed. Go to ${getHubSpotWebsiteOrigin(
      getEnv()
    )}/private-apps/${accountId}/${result.appId} to see your app.`
  );
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
