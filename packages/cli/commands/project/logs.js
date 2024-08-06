const { getEnv } = require('@hubspot/local-dev-lib/config');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const {
  ENVIRONMENTS,
} = require('@hubspot/local-dev-lib/constants/environments');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { outputLogs } = require('../../lib/ui/serverlessFunctionLogs');
const { fetchProject } = require('@hubspot/local-dev-lib/api/projects');
const { getTableContents, getTableHeader } = require('../../lib/ui/table');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const {
  getAppLogs,
  getPublicFunctionLogs,
  getLatestPublicFunctionLogs,
  getAppFunctions,
} = require('@hubspot/local-dev-lib/api/functions');

const { ensureProjectExists, getProjectConfig } = require('../../lib/projects');
const { loadAndValidateOptions } = require('../../lib/validation');
const { uiBetaTag, uiLine, uiLink } = require('../../lib/ui');
const { projectLogsPrompt } = require('../../lib/prompts/projectsLogsPrompt');
const { tailLogs } = require('../../lib/serverlessLogs');
const { i18n } = require('../../lib/lang');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { SERVERLESS_FUNCTION_TYPES } = require('../../lib/constants');
const {
  fetchPrivateAppsForPortal,
} = require('@hubspot/local-dev-lib/api/appsDev');

const i18nKey = 'commands.project.subcommands.logs';

const getPrivateAppsUrl = accountId => {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return `${baseUrl}/private-apps/${accountId}`;
};

const handleLogsError = (e, name, projectName) => {
  console.error(e);
  if (e.response && e.response.status === 404) {
    logger.debug(`Log fetch error: ${e.message}`);
    logger.log(i18n(`${i18nKey}.logs.noLogsFound`, { name }));
  } else {
    logApiErrorInstance(
      e,
      new ApiErrorContext({ accountId: getAccountId(), projectName })
    );
    return process.exit(EXIT_CODES.ERROR);
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
    appId,
  } = options;

  let logsResp;

  const tailCall = async after => {
    return appPath
      ? getAppLogs(accountId, appId)
      : getPublicFunctionLogs(accountId, functionName, { after });
  };

  const fetchLatest = async () => {
    return appPath
      ? getAppLogs(accountId, appId)
      : getLatestPublicFunctionLogs(
          accountId,
          functionName,
          projectName,
          appPath
        );
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
      handleLogsError(e, functionName, projectName);
      return true;
    }
  } else {
    try {
      logsResp = await tailCall();
    } catch (e) {
      handleLogsError(e, functionName, projectName);
      return true;
    }
  }

  if (logsResp) {
    outputLogs(logsResp, options);
    return true;
  }
  return false;
};

async function generateAppsChoicesForProject(accountId, projectName) {
  try {
    const { deployedBuild } = await fetchProject(accountId, projectName);

    if (!(deployedBuild && deployedBuild.subbuildStatuses)) {
      logger.debug('Failed to fetch project');
      return process.exit(EXIT_CODES.ERROR);
    }
    return deployedBuild.subbuildStatuses
      .filter(subBuild => subBuild.buildType === 'PRIVATE_APP')
      .map(subBuild => {
        console.log(subBuild);
        return {
          name: subBuild.buildName,
          value: { appName: subBuild.buildName, appId: subBuild.id },
        };
      });
  } catch (e) {
    logger.debug(e);
    logApiErrorInstance(
      e,
      new ApiErrorContext({ accountId: getAccountId(), projectName })
    );
    return process.exit(EXIT_CODES.ERROR);
  }
}

function generateFunctionTypeChoices() {
  const i18nKey = 'lib.prompts.projectLogsPrompt';
  return [
    {
      name: i18n(`${i18nKey}.logType.function`),
      value: SERVERLESS_FUNCTION_TYPES.APP_FUNCTION,
    },
    {
      name: i18n(`${i18nKey}.logType.endpoint`),
      value: SERVERLESS_FUNCTION_TYPES.PUBLIC_ENDPOINT,
    },
  ];
}

async function generateFunctionNameChoices(accountId, appName) {
  try {
    const privateApps = await fetchPrivateAppsForPortal(accountId);
  } catch (e) {
    console.error(e.response.data);
  }
  console.log(privateApps);
  const result = await getAppFunctions(accountId, appId);
  console.log(result);
  return [];
}

exports.command = 'logs';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  /* New flow design:
   * Automatically determine the project.
   * If we are not in a project, log an error
   * If no apps log an error
   * If more than one app, prompt for app, otherwise use the only app in the project
   * Lookup the functions for that app
   * If no functions log an error
   * If more than one function prompt for function
   * */
  const accountId = getAccountId(options);
  trackCommandUsage('project-logs', null, accountId);

  await loadAndValidateOptions(options);

  const { projectConfig } = await getProjectConfig();

  if (!projectConfig || !projectConfig.name) {
    //TODO Proper error message
    logger.error('Project config missing');
    return process.exit(EXIT_CODES.ERROR);
  }
  const { name: projectName } = projectConfig;

  const {
    appName: promptAppName,
    functionName: promptFunctionName,
    endpointName: promptEndpointName,
  } = await projectLogsPrompt({
    generateAppChoices: () =>
      generateAppsChoicesForProject(accountId, projectName),
    // generateFunctionTypeChoices: () => generateFunctionTypeChoices(),
    // generateFunctionNameChoices: appId =>
    //   generateFunctionNameChoices(accountId, appId),
    options,
  });

  const appName = options.app || promptAppName;
  await generateFunctionNameChoices(accountId, appName);

  const functionName =
    options.function || promptFunctionName || options.endpoint;
  const endpointName = options.endpoint || promptEndpointName;

  let relativeAppPath;
  let appId;

  if (appName && !endpointName) {
    await ensureProjectExists(accountId, projectName, {
      allowCreate: false,
    });

    let projectDetails;
    try {
      projectDetails = await fetchProject(accountId, projectName);
    } catch (e) {
      handleLogsError(e, functionName, projectName);
      return process.exit(EXIT_CODES.ERROR);
    }
    const { deployedBuild, id: projectId } = projectDetails;

    if (deployedBuild && deployedBuild.subbuildStatuses) {
      const appSubBuild = deployedBuild.subbuildStatuses.find(
        subBuild => subBuild.buildName === appName
      );
      if (!appSubBuild) {
        logger.error(
          i18n(`${i18nKey}.errors.invalidAppName`, {
            appName: options.app,
            projectName,
          })
        );
        return process.exit(EXIT_CODES.ERROR);
      }
      relativeAppPath = appSubBuild.rootPath;
    }
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

  if (endpointName) {
    logger.log(
      uiLink(
        i18n(`${i18nKey}.logs.hubspotLogsLink`),
        `${getPrivateAppsUrl(
          accountId
        )}/logs/serverlessGatewayExecution?path=${endpointName}`
      )
    );
  } else if (appId) {
    logger.log(
      uiLink(
        i18n(`${i18nKey}.logs.hubspotLogsDirectLink`),
        `${getPrivateAppsUrl(
          accountId
        )}/${appId}/logs/extensions?serverlessFunction=${functionName}`
      )
    );
  }
  logger.log();
  uiLine();

  const showFinalMessage = await handleFunctionLog(accountId, {
    ...options,
    projectName,
    appId,
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
      latest: {
        alias: 'l',
        describe: i18n(`${i18nKey}.options.latest.describe`),
        type: 'boolean',
      },
      compact: {
        describe: i18n(`${i18nKey}.options.compact.describe`),
        type: 'boolean',
      },
      tail: {
        alias: ['t', 'follow'],
        describe: i18n(`${i18nKey}.options.tail.describe`),
        type: 'boolean',
      },
      limit: {
        describe: i18n(`${i18nKey}.options.limit.describe`),
        type: 'number',
        default: 10,
      },
    })
    .conflicts('tail', 'limit')
    .example([['$0 project logs', i18n(`${i18nKey}.examples.default`)]])
    .example([
      [
        '$0 project logs --project=my-project --app=app --function=my-function',
        i18n(`${i18nKey}.examples.withOptions`),
      ],
    ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
