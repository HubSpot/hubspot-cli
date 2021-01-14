const ora = require('ora');
var https = require('https');
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

const makeSpinner = (actionText, functionPath, accountIdentifier) => {
  return ora(
    `${actionText} bundle for '${functionPath}' on account '${accountIdentifier}'.\n`
  );
};

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

const logBuildOutput = async resp => {
  return new Promise((resolve, reject) => {
    try {
      https
        .get(resp.cdnUrl, response => {
          let data = '';
          response.on('data', chunk => {
            data += chunk;
          });
          response.on('end', () => {
            resolve(data);
          });
        })
        .on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
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
    logger.error(`Specified path ${functionPath} is not a .functions folder.`);
    return;
  }

  logger.debug(
    `Starting build and deploy for .functions folder with path: ${functionPath}`
  );

  try {
    spinner = makeSpinner(
      'Building and deploying',
      functionPath,
      accountId
    ).start();
    const buildId = await buildPackage(accountId, functionPath);
    const successResp = await pollBuildStatus(accountId, buildId);
    const buildTimeSeconds = (successResp.buildTime / 1000).toFixed(2);
    spinner.stop();
    const buildOutput = await logBuildOutput(successResp);
    logger.log(buildOutput);
    logger.success(
      `Built and deployed bundle from package.json for ${functionPath} on account ${accountId} in ${buildTimeSeconds}s.`
    );
  } catch (e) {
    spinner && spinner.stop && spinner.stop();
    if (e.statusCode === 404) {
      logger.error(`Unable to find package.json for function ${functionPath}.`);
    } else if (e.statusCode === 400) {
      logger.error(e.error.message);
    } else if (e.status === 'ERROR') {
      const buildOutput = await logBuildOutput(e);
      logger.error(`Build error: ${e.errorReason}\n${buildOutput}`);
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
