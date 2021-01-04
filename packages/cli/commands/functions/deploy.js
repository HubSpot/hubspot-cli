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
} = require('@hubspot/cli-lib/api/functions');
const { validateAccount } = require('../../lib/validation');

const makeSpinner = (actionText, functionPath, accountIdentifier) => {
  return ora(
    `${actionText} bundle for '${functionPath}' on account '${accountIdentifier}'.\n`
  );
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
      spinner = makeSpinner('Deleting', functionPath, accountId);
      spinner.start();
      await deletePackage(accountId, `${functionPath}/package.json`);
      successMessage = `Successfully removed build package for ${functionPath} on account ${accountId}.`;
    } else {
      spinner = makeSpinner('Building and deploying', functionPath, accountId);
      spinner.start();
      await buildPackage(accountId, `${functionPath}/package.json`);
      successMessage = `Successfully built and deployed bundle from package.json for ${functionPath} on account ${accountId}.`;
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
