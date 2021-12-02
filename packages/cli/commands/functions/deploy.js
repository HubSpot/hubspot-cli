const Spinnies = require('spinnies');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
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
const { loadAndValidateOptions } = require('../../lib/validation');
const { outputBuildLog } = require('../../lib/serverlessLogs');

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

exports.command = 'deploy <path>';
exports.describe = false;

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { path: functionPath } = options;
  const accountId = getAccountId(options);
  const splitFunctionPath = functionPath.split('.');
  const spinnies = new Spinnies();
  spinnies.add('buildAndDeployStatus', {
    text: `Building and deploying bundle for '${functionPath}' on account '${accountId}'.\n`,
  });

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
    const buildId = await buildPackage(accountId, functionPath);
    const successResp = await pollBuildStatus(accountId, buildId);
    const buildTimeSeconds = (successResp.buildTime / 1000).toFixed(2);
    spinnies.remove('buildAndDeployStatus');
    spinnies.stopAll();
    await outputBuildLog(successResp.cdnUrl);
    logger.success(
      `Built and deployed bundle from package.json for ${functionPath} on account ${accountId} in ${buildTimeSeconds}s.`
    );
  } catch (e) {
    spinnies.remove('buildAndDeployStatus');
    spinnies.stopAll();
    if (e.statusCode === 404) {
      logger.error(`Unable to find package.json for function ${functionPath}.`);
    } else if (e.statusCode === 400) {
      logger.error(e.error.message);
    } else if (e.status === 'ERROR') {
      await outputBuildLog(e.cdnUrl);
      logger.error(`Build error: ${e.errorReason}`);
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
    describe: 'Path to .functions folder',
    type: 'string',
  });

  yargs.example([
    [
      '$0 functions deploy myFunctionFolder.functions',
      'Build and deploy a new bundle for all functions within the myFunctionFolder.functions folder',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
