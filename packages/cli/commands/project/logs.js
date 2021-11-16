const Spinnies = require('spinnies');
const { getCwd } = require('@hubspot/cli-lib/path');
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
const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/cli-lib/api/results');
const { getProjectConfig } = require('../../lib/projects');
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

const handleLogsError = (e, accountId, projectName, appPath, functionName) => {
  if (e.statusCode === 404) {
    logger.error(
      appPath
        ? `No logs were found for the function name '${functionName}' in the app path '${appPath}' within the project '${projectName}' in account ${accountId}.`
        : `No logs were found for the function name '${functionName}' within the project '${projectName}' in account ${accountId}.`
    );
  }
};

const functionLog = async (accountId, options) => {
  const {
    latest,
    follow,
    compact,
    appPath,
    functionName,
    projectName,
  } = options;

  let logsResp;

  const tailCall = async after => {
    try {
      return appPath
        ? getProjectAppFunctionLogs(
            accountId,
            functionName,
            projectName,
            appPath,
            {
              after,
            }
          )
        : getFunctionLogs(accountId, functionName, { after });
    } catch (e) {
      handleLogsError(e, accountId, projectName, appPath, functionName);
    }
  };
  const fetchLatest = async () => {
    return appPath
      ? getLatestProjectAppFunctionLog(
          accountId,
          functionName,
          projectName,
          appPath
        )
      : getLatestFunctionLog(accountId, functionName);
  };

  if (follow) {
    const spinnies = new Spinnies();

    spinnies.add('tailLogs', {
      text: `Waiting for log entries for '${functionName}' on account '${accountId}'.\n`,
    });
    try {
      await fetchLatest();
    } catch (e) {
      handleLogsError(e, accountId, projectName, appPath, functionName);
    }
    await tailLogs({
      accountId,
      compact,
      spinnies,
      tailCall,
      fetchLatest,
    });
  } else if (latest) {
    try {
      logsResp = await fetchLatest();
    } catch (e) {
      handleLogsError(e, accountId, projectName, appPath, functionName);
    }
  } else {
    try {
      logsResp = await tailCall();
    } catch (e) {
      handleLogsError(e, accountId, projectName, appPath, functionName);
    }
  }

  if (logsResp) {
    return outputLogs(logsResp, options);
  }
};

exports.command = 'logs';
exports.describe = 'get logs for a function within a project';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { latest, function: functionName, appPath } = options;
  let projectName = options.projectName;

  if (!functionName) {
    logger.error('You must pass a function name to retrieve logs for.');
    process.exit(1);
  } else if (!projectName) {
    const { projectConfig } = await getProjectConfig(getCwd());
    if (projectConfig.name) {
      projectName = projectConfig.name;
    } else {
      logger.error(
        'You must specify a project name using the --projectName argument.'
      );
      process.exit(1);
    }
  } else if (!appPath) {
    logger.error('You must specify an app path using the --appPath argument.');
    process.exit(1);
  }

  const accountId = getAccountId(options);

  trackCommandUsage('project-logs', { latest }, accountId);

  functionLog(accountId, { ...options, projectName });
};

exports.builder = yargs => {
  yargs
    .options({
      function: {
        describe: 'Serverless app function name or endpoint route',
        type: 'string',
        demandOption: true,
      },
      appPath: {
        describe: 'path to the app (required for app functions)',
        type: 'string',
      },
      projectName: {
        describe: 'name of the project',
        type: 'string',
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
      '$0 project logs --function=my-function --appName="app" --projectName="my-project"',
      'Get 5 most recent logs for function named "my-function" within the app named "app" within the project named "my-project"',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
