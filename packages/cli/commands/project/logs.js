const { getEnv } = require('@hubspot/cli-lib/lib/config');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { ENVIRONMENTS } = require('@hubspot/cli-lib/lib/constants');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/cli-lib/logger');
const { outputLogs } = require('@hubspot/cli-lib/lib/logs');
const { fetchProject } = require('@hubspot/cli-lib/api/dfs');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/cli-lib/lib/table');
const {
  getProjectAppFunctionLogs,
  getLatestProjectAppFunctionLog,
} = require('@hubspot/cli-lib/api/functions');
const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/cli-lib/api/results');
const { ensureProjectExists } = require('../../lib/projects');
const { loadAndValidateOptions } = require('../../lib/validation');
const { uiLine, uiLink, uiPromptShortcut } = require('../../lib/ui');
const { projectLogsPrompt } = require('../../lib/prompts/projectsLogsPrompt');
const { tailLogs } = require('../../lib/serverlessLogs');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.commands.project.subcommands.logs';

const getPrivateAppsUrl = accountId => {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return `${baseUrl}/private-apps/${accountId}`;
};

const handleLogsError = (e, name) => {
  logger.debug(`Log fetch error: ${e.message}`);
  if (e.statusCode === 404) {
    logger.log(i18n(`${i18nKey}.logs.noLogsFound`, { name }));
  }
};

const handleFunctionLog = async (accountId, options) => {
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
      handleLogsError(e, functionName);
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
    await tailLogs({
      accountId,
      compact,
      tailCall,
      fetchLatest,
      name: functionName,
    });
  } else if (latest) {
    try {
      logsResp = await fetchLatest();
    } catch (e) {
      handleLogsError(e, functionName);
      return true;
    }
  } else {
    try {
      logsResp = await tailCall();
    } catch (e) {
      handleLogsError(e, functionName);
      return true;
    }
  }

  if (logsResp) {
    outputLogs(logsResp, options);
    return true;
  }
  return false;
};

exports.command = 'logs [--project] [--app] [--function] [--endpoint]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  const {
    projectName: promptProjectName,
    appName: promptAppName,
    functionName: promptFunctionName,
    endpointName: promptEndpointName,
  } = await projectLogsPrompt(accountId, options);

  const projectName = options.project || promptProjectName;
  const appName = options.app || promptAppName;
  const functionName =
    options.function || promptFunctionName || options.endpoint;
  const endpointName = options.endpoint || promptEndpointName;

  let relativeAppPath;

  if (appName && !endpointName) {
    await ensureProjectExists(accountId, projectName, {
      allowCreate: false,
    });
    const { deployedBuild } = await fetchProject(accountId, projectName);

    if (deployedBuild && deployedBuild.subbuildStatuses) {
      const appSubbuild = deployedBuild.subbuildStatuses.find(
        subbuild => subbuild.buildName === appName
      );
      if (appSubbuild) {
        relativeAppPath = appSubbuild.rootPath;
      } else {
        logger.error(
          i18n(`${i18nKey}.errors.invalidAppName`, {
            appName: options.app,
            projectName,
          })
        );
        process.exit(EXIT_CODES.ERROR);
      }
    }
  }

  trackCommandUsage('project-logs', { latest: options.latest }, accountId);

  // Show shortcut if any of the prompt questions were answered
  const promptUsed =
    !!promptProjectName ||
    !!promptAppName ||
    !!promptFunctionName ||
    promptEndpointName;
  if (promptUsed) {
    let optionShortcut;

    if (endpointName) {
      optionShortcut = `--project="${projectName}" --endpoint="${endpointName}"`;
    } else {
      optionShortcut = `--project="${projectName}" --app="${appName}" --function="${functionName}"`;
    }
    uiPromptShortcut(`hs project logs ${optionShortcut}`);
    logger.log('');
  }

  const logsInfo = [accountId, `"${projectName}"`];
  let tableHeader;

  if (endpointName) {
    logsInfo.push(`"${endpointName}"`);
    tableHeader = getTableHeader([
      i18n(`${i18nKey}.table.accountHeader`),
      i18n(`${i18nKey}.table.projectHeader`),
      i18n(`${i18nKey}.table.endpointHeader`),
    ]);
  } else {
    logsInfo.push(`"${appName}"`);
    logsInfo.push(functionName);
    tableHeader = getTableHeader([
      i18n(`${i18nKey}.table.accountHeader`),
      i18n(`${i18nKey}.table.projectHeader`),
      i18n(`${i18nKey}.table.appHeader`),
      i18n(`${i18nKey}.table.functionHeader`),
    ]);
  }

  logger.log(i18n(`${i18nKey}.logs.showingLogs`));
  logger.log(
    getTableContents([tableHeader, logsInfo], { border: { bodyLeft: '  ' } })
  );

  logger.log(
    uiLink(
      i18n(`${i18nKey}.logs.hubspotLogsLink`),
      getPrivateAppsUrl(accountId)
    )
  );
  logger.log();
  uiLine();

  const showFinalMessage = await handleFunctionLog(accountId, {
    ...options,
    projectName,
    appPath: relativeAppPath,
    functionName: functionName || endpointName,
  });

  if (showFinalMessage) {
    uiLine();
  }
};

exports.builder = yargs => {
  yargs
    .options({
      function: {
        alias: 'function',
        describe: i18n(`${i18nKey}.options.function.describe`),
        requiresArg: true,
        type: 'string',
      },
      endpoint: {
        alias: 'endpoint',
        describe: i18n(`${i18nKey}.options.endpoint.describe`),
        requiresArg: true,
        type: 'string',
      },
      app: {
        describe: i18n(`${i18nKey}.options.app.describe`),
        requiresArg: true,
        type: 'string',
      },
      project: {
        describe: i18n(`${i18nKey}.options.project.describe`),
        requiresArg: true,
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

  yargs.example([['$0 project logs', i18n(`${i18nKey}.examples.default`)]]);
  yargs.example([
    [
      '$0 project logs --project=my-project --app=app --function=my-function',
      i18n(`${i18nKey}.examples.withOptions`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
