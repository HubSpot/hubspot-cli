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
const {
  fetchProjectComponentsMetadata,
} = require('@hubspot/local-dev-lib/api/projects');
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
const ProjectLogsManager = require('../../lib/projectLogsManager');

const i18nKey = 'commands.project.subcommands.logs';

const getPrivateAppsUrl = accountId => {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return `${baseUrl}/private-apps/${accountId}`;
};

const handleLogsError = (e, name, projectName) => {
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
    try {
      // return appId
      //   ?
      return getAppLogs(accountId, appId);
      // : getPublicFunctionLogs(accountId, functionName, { after });
    } catch (e) {
      console.error(e.response.data);
    }
  };

  const fetchLatest = async () => {
    try {
      return getAppLogs(accountId, appId);
      // return appId
      // ? getAppLogs(accountId, appId)
      // : getLatestPublicFunctionLogs(
      //     accountId,
      //     functionName,
      //     projectName,
      //     appPath
      //   );
    } catch (e) {
      console.error(e.response.data);
    }
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

function logTable(tableHeader, logsInfo) {
  logger.log(i18n(`${i18nKey}.logs.showingLogs`));
  logger.log(
    getTableContents([tableHeader, logsInfo], { border: { bodyLeft: '  ' } })
  );
}

function logPreamble(accountId, projectLogsManager) {
  const logsInfo = [accountId]; //, `"${ProjectLogsManager.projectName}"`];
  let tableHeader;

  if (projectLogsManager.isPublicFunction) {
    logsInfo.push(projectLogsManager.functionName);
    // logsInfo.push(`"${endpointName}"`);
    tableHeader = getTableHeader([
      i18n(`${i18nKey}.table.accountHeader`),
      // i18n(`${i18nKey}.table.projectHeader`),
      i18n(`${i18nKey}.table.endpointHeader`),
    ]);
    logTable(tableHeader, logsInfo);
    logger.log(
      uiLink(
        i18n(`${i18nKey}.logs.hubspotLogsLink`),
        `${getPrivateAppsUrl(accountId)}/${
          projectLogsManager.appId
        }/logs/serverlessGatewayExecution?path=${
          projectLogsManager.endpointName
        }`
      )
    );
  } else {
    // logsInfo.push(`"${ProjectLogsManager.appName}"`);
    logsInfo.push(projectLogsManager.functionName);
    tableHeader = getTableHeader([
      i18n(`${i18nKey}.table.accountHeader`),
      // i18n(`${i18nKey}.table.projectHeader`),
      // i18n(`${i18nKey}.table.appHeader`),
      i18n(`${i18nKey}.table.functionHeader`),
    ]);
    logTable(tableHeader, logsInfo);
    logger.log(
      uiLink(
        i18n(`${i18nKey}.logs.hubspotLogsDirectLink`),
        `${getPrivateAppsUrl(accountId)}/${
          projectLogsManager.appId
        }/logs/crm?serverlessFunction=${projectLogsManager.functionName}`
      )
    );
  }
  logger.log();
  uiLine();
}

exports.command = 'logs';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  const accountId = getAccountId(options);
  trackCommandUsage('project-logs', null, accountId);

  await loadAndValidateOptions(options);

  try {
    await ProjectLogsManager.init(accountId);

    const { functionName } = await projectLogsPrompt({
      functionChoices: ProjectLogsManager.getFunctionNames(),
    });

    ProjectLogsManager.setFunction(functionName);
    logPreamble(accountId, ProjectLogsManager);

    const showFinalMessage = await handleFunctionLog(accountId, {
      ...options,
      projectName: ProjectLogsManager.projectName,
      appId: ProjectLogsManager.appId,
      functionName: ProjectLogsManager.functionName, //|| endpointName,
    });

    if (showFinalMessage) {
      uiLine();
    }
  } catch (e) {
    logger.error(e);
    return process.exit(EXIT_CODES.ERROR);
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
