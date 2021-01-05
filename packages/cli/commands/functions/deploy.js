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
const { logger } = require('@hubspot/cli-lib/logger');
const {
  buildPackage,
  deletePackage,
  pollBuild,
} = require('@hubspot/cli-lib/api/functions');
const { validateAccount } = require('../../lib/validation');

const makeSpinner = (actionText, functionPath, accountIdentifier) => {
  return ora(
    `${actionText} bundle for '${functionPath}' on account '${accountIdentifier}'.\n`
  );
};

const pollBuildStatus = (accountId, buildId) => {
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      const pollResp = await pollBuild(accountId, buildId);
      const { status } = pollResp;

      if (status === 'SUCCESS') {
        clearInterval(pollInterval);
        resolve(pollResp);
      } else if (status === 'ERROR') {
        clearInterval(pollInterval);
        reject(pollResp);
      }
    }, 1000);
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
// Uncomment to unhide 'builds a new dependency bundle for the specified .functions folder';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: functionPath } = options;
  const accountId = getAccountId(options);
  const { delete: shouldDeletePackage } = options;
  const splitFunctionPath = functionPath.split('.');
  let spinner;

  trackCommandUsage('functions-deploy', { functionPath }, accountId);

  if (
    !splitFunctionPath.length ||
    splitFunctionPath[splitFunctionPath.length - 1] !== 'functions'
  ) {
    logger.error(`Specified path ${functionPath} is not a .functions folder.`);
    return;
  }

  logger.debug(
    `Starting build and deploy for .functions folder with path: ${functionPath}`
  );

  try {
    let successMessage;
    if (shouldDeletePackage) {
      spinner = makeSpinner('Deleting', functionPath, accountId).start();
      await deletePackage(accountId, `${functionPath}/package.json`);
      successMessage = `Successfully removed build package for ${functionPath} on account ${accountId}.`;
    } else {
      spinner = makeSpinner(
        'Building and deploying',
        functionPath,
        accountId
      ).start();
      const buildId = await buildPackage(accountId, functionPath);
      const successResp = await pollBuildStatus(accountId, buildId);
      const buildTimeSeconds = (successResp.buildTime / 1000).toFixed(2);
      successMessage = `Successfully built and deployed bundle from package.json for ${functionPath} on account ${accountId} in ${buildTimeSeconds}s.`;
    }
    spinner.stop();
    logger.success(successMessage);
  } catch (e) {
    spinner && spinner.stop && spinner.stop();
    if (e.statusCode === 404) {
      logger.error(`Unable to find package.json for function ${functionPath}.`);
    } else if (e.statusCode === 400) {
      logger.error(e.error.message);
    } else {
      logApiErrorInstance(
        accountId,
        e,
        new ApiErrorContext({ accountId, functionPath })
      );
    }
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to .functions folder',
    type: 'string',
  });

  yargs.option('delete', {
    alias: 'D',
    describe: 'Remove currently built and deployed package',
    type: 'boolean',
  });

  yargs.example([
    [
      '$0 functions deploy myFunctionFolder.functions',
      'Build and deploy a new bundle for all functions within the myFunctionFolder.functions folder',
    ],
    [
      '$0 functions deploy myFunctionFolder.functions --delete',
      'Delete the currently built and deployed bundle used by all functions within the myFunctionFolder.functions folder',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
