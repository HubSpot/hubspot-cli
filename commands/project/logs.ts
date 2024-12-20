// @ts-nocheck
const { getEnv } = require('@hubspot/local-dev-lib/config');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const {
  ENVIRONMENTS,
} = require('@hubspot/local-dev-lib/constants/environments');
const { addUseEnvironmentOptions } = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { getTableContents, getTableHeader } = require('../../lib/ui/table');
const { logError } = require('../../lib/errorHandlers/');

const { loadAndValidateOptions } = require('../../lib/validation');
const { uiBetaTag, uiLine, uiLink } = require('../../lib/ui');
const { projectLogsPrompt } = require('../../lib/prompts/projectsLogsPrompt');
const { i18n } = require('../../lib/lang');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const ProjectLogsManager = require('../../lib/projects/ProjectLogsManager');

const i18nKey = 'commands.project.subcommands.logs';

const getPrivateAppsUrl = accountId => {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return `${baseUrl}/private-apps/${accountId}`;
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
        i18n(`${i18nKey}.logs.hubspotLogsDirectLink`),
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
  const { derivedAccountId } = options;
  trackCommandUsage('project-logs', null, derivedAccountId);

  await loadAndValidateOptions(options);

  try {
    await ProjectLogsManager.init(derivedAccountId);

    const { functionName } = await projectLogsPrompt({
      functionChoices: ProjectLogsManager.getFunctionNames(),
      promptOptions: options,
      projectName: ProjectLogsManager.projectName,
    });

    ProjectLogsManager.setFunction(functionName);

    logPreamble();
  } catch (e) {
    logError(e, {
      accountId: derivedAccountId,
      projectName: ProjectLogsManager.projectName,
    });
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
    .example([
      ['$0 project logs', i18n(`${i18nKey}.examples.default`)],
      [
        '$0 project logs --function=my-function',
        i18n(`${i18nKey}.examples.withOptions`),
      ],
    ]);

  addUseEnvironmentOptions(yargs);

  return yargs;
};
