const ora = require('ora');
const { getEnv } = require('@hubspot/cli-lib');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { logger } = require('@hubspot/cli-lib/logger');
const { deployAppSync } = require('@hubspot/cli-lib/api/appPipeline');

const {
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { outputBuildLog } = require('../../lib/serverlessLogs');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.app.subcommands.deploy';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

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
  await loadAndValidateOptions(options);

  const { path: appPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('app-deploy', {}, accountId);

  let result;

  const spinner = ora(
    i18n(`${i18nKey}.building`, {
      accountId,
      appPath,
    })
  ).start();
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
    process.exit(EXIT_CODES.ERROR);
  }

  spinner.succeed();
  logger.success(
    i18n(`${i18nKey}.success.deployed`, {
      appUrl: `${getHubSpotWebsiteOrigin(getEnv())}/private-apps/${accountId}/${
        result.appId
      }`,
    })
  );
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });

  yargs.example([
    ['$0 app deploy /example-app', i18n(`${i18nKey}.examples.default`)],
  ]);

  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
