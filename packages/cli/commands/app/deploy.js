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
const { outputBuildLog } = require('../../lib/serverlessLogs');

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

const logServerlessBuildFailures = async errorDetails => {
  const folderPaths = errorDetails.context.folderPath;
  const buildLogUrls = errorDetails.context.serverlessBuildLogUrl;
  for (let i = 0; i < buildLogUrls.length; i++) {
    logger.log(`Building serverless functions in "${folderPaths[i]}":`);
    await outputBuildLog(buildLogUrls[i]);
  }
  logger.error(
    'Your app failed to build and deploy due to a problem building the serverless functions.'
  );
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
    spinner.fail();
    if (error.response && error.response.body) {
      const errorDetails = error.response.body;
      if (
        errorDetails.subCategory === 'PipelineErrors.SERVERLESS_BUILD_ERROR' &&
        errorDetails.context &&
        Array.isArray(errorDetails.context.serverlessBuildLogUrl)
      ) {
        await logServerlessBuildFailures(errorDetails);
      } else {
        logApiErrorInstance(
          error,
          new ApiErrorContext({
            accountId,
            request: appPath,
          })
        );
      }
    } else {
      logApiErrorInstance(
        error,
        new ApiErrorContext({
          accountId,
          request: appPath,
        })
      );
    }
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
