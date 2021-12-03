const Spinnies = require('spinnies');
const { getCwd } = require('@hubspot/cli-lib/path');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
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
const { loadAndValidateOptions } = require('../../lib/validation');
const { tailLogs } = require('../../lib/serverlessLogs');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.project.subcommands.logs';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const handleLogsError = (e, accountId, projectName, appPath, functionName) => {
  if (e.statusCode === 404) {
    logger.error(
      i18n(`${i18nKey}.errors.logs`, {
        accountId,
        appPath,
        functionName,
        projectName,
      })
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
      text: i18n(`${i18nKey}.loading`),
    });

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
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { latest, functionName } = options;
  let projectName = options.projectName;

  if (!functionName) {
    logger.error(i18n(`${i18nKey}.errors.functionNameRequired`));
    process.exit(EXIT_CODES.ERROR);
  } else if (!projectName) {
    const { projectConfig } = await getProjectConfig(getCwd());
    if (projectConfig && projectConfig.name) {
      projectName = projectConfig.name;
    } else {
      logger.error(i18n(`${i18nKey}.errors.projectNameRequired`));
      process.exit(EXIT_CODES.ERROR);
    }
  }

  const accountId = getAccountId(options);

  trackCommandUsage('project-logs', { latest }, accountId);

  functionLog(accountId, { ...options, projectName });
};

exports.builder = yargs => {
  yargs
    .options({
      functionName: {
        alias: 'function',
        describe: i18n(`${i18nKey}.positionals.functionName.describe`),
        type: 'string',
        demandOption: true,
      },
      appPath: {
        describe: i18n(`${i18nKey}.options.appPath.describe`),
        type: 'string',
      },
      projectName: {
        describe: i18n(`${i18nKey}.options.projectName.describe`),
        type: 'string',
      },
      latest: {
        alias: 'l',
        describe: i18n(`${i18nKey}.options.latest.describe`),
        type: 'boolean',
      },
      compact: {
        describe: i18n(`${i18nKey}.options.compact.describe`),
        type: 'boolean',
      },
      follow: {
        alias: ['t', 'tail', 'f'],
        describe: i18n(`${i18nKey}.options.follow.describe`),
        type: 'boolean',
      },
      limit: {
        alias: ['limit', 'n', 'max-count'],
        describe: i18n(`${i18nKey}.options.limit.describe`),
        type: 'number',
      },
    })
    .conflicts('follow', 'limit');

  yargs.example([
    [
      '$0 project logs --function=my-function --appPath="app" --projectName="my-project"',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
