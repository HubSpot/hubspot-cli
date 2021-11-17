const ora = require('ora');
const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { POLLING_DELAY } = require('@hubspot/cli-lib/lib/constants');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  buildPackage,
  getBuildStatus,
} = require('@hubspot/cli-lib/api/functions');
const { validateAccount } = require('../../lib/validation');
const { outputBuildLog } = require('../../lib/serverlessLogs');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.functions.subcommands.deploy';

const pollBuildStatus = (accountId, buildId) => {
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      const pollResp = await getBuildStatus(accountId, buildId);
      const { status } = pollResp;

      if (status === 'SUCCESS') {
        clearInterval(pollInterval);
        resolve(pollResp);
      } else if (status === 'ERROR') {
        clearInterval(pollInterval);
        reject(pollResp);
      }
    }, POLLING_DELAY);
  });
};

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

  const { path: functionPath } = options;
  const accountId = getAccountId(options);
  const splitFunctionPath = functionPath.split('.');
  let spinner;

  trackCommandUsage('functions-deploy', { functionPath }, accountId);

  if (
    !splitFunctionPath.length ||
    splitFunctionPath[splitFunctionPath.length - 1] !== 'functions'
  ) {
    logger.error(
      i18n(`${i18nKey}.errors.notFunctionsFolder`, {
        functionPath,
      })
    );
    return;
  }

  logger.debug(
    i18n(`${i18nKey}.debug.startingBuildAndDeploy`, {
      functionPath,
    })
  );

  try {
    spinner = ora(
      i18n(`${i18nKey}.loading`, {
        accountId,
        functionPath,
      })
    ).start();
    const buildId = await buildPackage(accountId, functionPath);
    const successResp = await pollBuildStatus(accountId, buildId);
    const buildTimeSeconds = (successResp.buildTime / 1000).toFixed(2);
    spinner.stop();
    await outputBuildLog(successResp.cdnUrl);
    logger.success(
      i18n(`${i18nKey}.success.deploy`, {
        accountId,
        buildTimeSeconds,
        functionPath,
      })
    );
  } catch (e) {
    spinner && spinner.stop && spinner.stop();
    if (e.statusCode === 404) {
      logger.error(
        i18n(`${i18nKey}.errors.noPackageJson`, {
          functionPath,
        })
      );
    } else if (e.statusCode === 400) {
      logger.error(e.error.message);
    } else if (e.status === 'ERROR') {
      await outputBuildLog(e.cdnUrl);
      logger.error(
        i18n(`${i18nKey}.errors.buildError`, {
          details: e.errorReason,
        })
      );
    } else {
      logApiErrorInstance(
        accountId,
        e,
        new ApiErrorContext({ accountId, request: functionPath })
      );
    }
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });

  yargs.example([
    [
      '$0 functions deploy myFunctionFolder.functions',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
