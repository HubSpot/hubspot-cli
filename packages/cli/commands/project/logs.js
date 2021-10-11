const Spinnies = require('spinnies');
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
const { logger } = require('@hubspot/cli-lib/logger');
const { outputLogs } = require('@hubspot/cli-lib/lib/logs');
const {
  getProjectAppFunctionLogs,
  getLatestProjectAppFunctionLog,
} = require('@hubspot/cli-lib/api/functions');
const { validateAccount } = require('../../lib/validation');
const { tailLogs } = require('../../lib/serverlessLogs');

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

const handleLatestLogsError = e => {
  if (e.statusCode === 404) {
    logger.log('No logs found.');
  }
};

const appFunctionLog = async (accountId, options) => {
  const {
    latest,
    follow,
    compact,
    appPath,
    functionName,
    projectName,
  } = options;

  let logsResp;

  if (follow) {
    const spinnies = new Spinnies();

    spinnies.add('tailLogs', {
      text: `Waiting for log entries for '${functionName}' on account '${accountId}'.\n`,
    });
    const tailCall = after =>
      getProjectAppFunctionLogs(accountId, functionName, projectName, appPath, {
        after,
      });
    const fetchLatest = () => {
      try {
        return getLatestProjectAppFunctionLog(
          accountId,
          functionName,
          projectName,
          appPath
        );
      } catch (e) {
        handleLatestLogsError(e);
      }
    };

    await tailLogs({
      accountId,
      compact,
      spinnies,
      tailCall,
      fetchLatest,
    });
  } else if (latest) {
    try {
      logsResp = await getLatestProjectAppFunctionLog(
        accountId,
        functionName,
        projectName,
        appPath
      );
    } catch (e) {
      handleLatestLogsError(e);
    }
  } else {
    logsResp = await getProjectAppFunctionLogs(
      accountId,
      functionName,
      projectName,
      appPath,
      {}
    );
  }

  if (logsResp) {
    return outputLogs(logsResp, options);
  }
};

exports.command = 'logs [functionName]';
exports.describe = 'get logs for a function within a project';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { latest, functionName, projectName, appPath } = options;

  if (!functionName) {
    logger.error('You must pass a function name to retrieve logs for.');
    process.exit(0);
  } else if (!projectName) {
    logger.error(
      'You must specify a project name using the --projectName argument.'
    );
    process.exit(0);
  } else if (!appPath) {
    logger.error('You must specify an app path using the --appPath argument.');
    process.exit(0);
  }

  const accountId = getAccountId(options);

  trackCommandUsage('project-logs', { latest }, accountId);

  appFunctionLog(accountId, options);
};

exports.builder = yargs => {
  yargs.positional('functionName', {
    describe: 'Serverless function name',
    type: 'string',
  });
  yargs
    .options({
      appPath: {
        describe: 'path to the app',
        type: 'string',
        hidden: true,
      },
      projectName: {
        describe: 'name of the project',
        type: 'string',
        hidden: true,
      },
      latest: {
        alias: 'l',
        describe: 'retrieve most recent log only',
        type: 'boolean',
      },
      compact: {
        describe: 'output compact logs',
        type: 'boolean',
      },
      follow: {
        alias: ['t', 'tail', 'f'],
        describe: 'follow logs',
        type: 'boolean',
      },
      limit: {
        alias: ['limit', 'n', 'max-count'],
        describe: 'limit the number of logs to output',
        type: 'number',
      },
    })
    .conflicts('follow', 'limit');

  yargs.example([
    [
      '$0 project logs my-function --appName="app" --projectName="my-project"',
      'Get 5 most recent logs for function named "my-function" within the app named "app" within the project named "my-project"',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
