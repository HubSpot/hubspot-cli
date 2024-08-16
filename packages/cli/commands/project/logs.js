const { getEnv } = require('@hubspot/local-dev-lib/config');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const {
  ENVIRONMENTS,
} = require('@hubspot/local-dev-lib/constants/environments');
const {
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { outputLogs } = require('../../lib/ui/serverlessFunctionLogs');
const { getTableContents, getTableHeader } = require('../../lib/ui/table');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');

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
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
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
  const { latest, follow, compact, functionName } = options;

  let logsResp;

  if (follow) {
    await tailLogs({
      accountId,
      compact,
      tailCall: ProjectLogsManager.tailCall,
      fetchLatest: ProjectLogsManager.fetchLatest,
      name: functionName,
    });
  } else if (latest) {
    logsResp = await ProjectLogsManager.fetchLatest();
  } else {
    logsResp = await ProjectLogsManager.tailCall();
  }

  if (logsResp) {
    outputLogs(logsResp, options);
  }
  return !!logsResp;
};

function logTable(tableHeader, logsInfo) {
  logger.log(i18n(`${i18nKey}.logs.showingLogs`));
  logger.log(
    getTableContents([tableHeader, logsInfo], { border: { bodyLeft: '  ' } })
  );
}

function logPreamble() {
  if (ProjectLogsManager.isPublicFunction) {
    logTable(
      getTableHeader([
        i18n(`${i18nKey}.table.accountHeader`),
        i18n(`${i18nKey}.table.functionHeader`),
        i18n(`${i18nKey}.table.endpointHeader`),
      ]),
      [
        ProjectLogsManager.accountId,
        ProjectLogsManager.functionName,
        ProjectLogsManager.endpointName,
      ]
    );
    logger.log(
      uiLink(
        i18n(`${i18nKey}.logs.hubspotLogsLink`),
        `${getPrivateAppsUrl(ProjectLogsManager.accountId)}/${
          ProjectLogsManager.appId
        }/logs/serverlessGatewayExecution?path=${
          ProjectLogsManager.endpointName
        }`
      )
    );
  } else {
    logTable(
      getTableHeader([
        i18n(`${i18nKey}.table.accountHeader`),
        i18n(`${i18nKey}.table.functionHeader`),
      ]),
      [ProjectLogsManager.accountId, ProjectLogsManager.functionName]
    );
    logger.log(
      uiLink(
        i18n(`${i18nKey}.logs.hubspotLogsDirectLink`),
        `${getPrivateAppsUrl(ProjectLogsManager.accountId)}/${
          ProjectLogsManager.appId
        }/logs/crm?serverlessFunction=${ProjectLogsManager.functionName}`
      )
    );
  }
  logger.log();
  uiLine();
}

exports.command = 'logs';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  logger.error('OH NO');
  process.exit(1);
  const accountId = getAccountId(options);
  trackCommandUsage('project-logs', null, accountId);

  await loadAndValidateOptions(options);

  try {
    await ProjectLogsManager.init(accountId);

    const { functionName } = await projectLogsPrompt({
      functionChoices: ProjectLogsManager.getFunctionNames(),
    });

    ProjectLogsManager.setFunction(functionName);

    logPreamble();

    const logsFound = await handleFunctionLog(accountId, {
      ...options,
      projectName: ProjectLogsManager.projectName,
      functionName: ProjectLogsManager.functionName, //|| endpointName,
    });

    if (logsFound) {
      uiLine();
    }
  } catch (e) {
    handleLogsError(
      e,
      ProjectLogsManager.functionName,
      ProjectLogsManager.projectName
    );
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

  addUseEnvironmentOptions(yargs);

  return yargs;
};
