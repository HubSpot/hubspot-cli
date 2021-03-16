// const ora = require('ora');
// var https = require('https');
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
const { deployProject } = require('@hubspot/cli-lib/api/fileMapper');
const { validateAccount } = require('../../lib/validation');

// const makeSpinner = (actionText, functionPath, accountIdentifier) => {
//   return ora(
//     `${actionText} bundle for '${functionPath}' on account '${accountIdentifier}'.\n`
//   );
// };

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

  const { path: projectPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-deploy', { projectPath }, accountId);

  logger.debug(`Deploying project at path: ${projectPath}`);

  try {
    const deployResp = await deployProject(accountId, projectPath);

    if (deployResp.error) {
      logger.error(`Deploy error: ${deployResp.error.message}`);
    }

    logger.success(
      `Deployed project in ${projectPath} on account ${accountId}.`
    );
  } catch (e) {
    // spinner && spinner.stop && spinner.stop();
    // if (e.statusCode === 404) {
    //   logger.error(`Unable to find package.json for function ${functionPath}.`);
    // } else if (e.statusCode === 400) {
    //   logger.error(e.error.message);
    // } else if (e.status === 'ERROR') {
    //   const buildOutput = await logBuildOutput(e);
    //   logger.log(buildOutput);
    //   logger.error(`Build error: ${e.errorReason}`);
    // } else {
    logApiErrorInstance(
      accountId,
      e,
      new ApiErrorContext({ accountId, projectPath })
    );
    // }
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to a project folder',
    type: 'string',
  });

  yargs.example([
    [
      '$0 project deploy myProjectFolder',
      'Deploy a project within the myProjectFolder folder',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
