const { getEnv } = require('@hubspot/local-dev-lib/config');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { ENVIRONMENTS } = require('@hubspot/cli-lib/lib/constants');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/cli-lib/logger');
// const { outputLogs } = require('@hubspot/cli-lib/lib/logs');
const {
  fetchProject,
  fetchDeployComponentsMetadata,
} = require('@hubspot/cli-lib/api/dfs');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/local-dev-lib/logging/table');
// const {
//   getProjectAppFunctionLogs,
//   getLatestProjectAppFunctionLog,
// } = require('@hubspot/cli-lib/api/functions');
// const {
//   logApiErrorInstance,
//   ApiErrorContext,
// } = require('../../lib/errorHandlers/apiErrors');
// const {
//   getFunctionLogs,
//   getLatestFunctionLog,
// } = require('@hubspot/cli-lib/api/results');
const { ensureProjectExists } = require('../../lib/projects');
const { loadAndValidateOptions } = require('../../lib/validation');
const { uiBetaTag, uiLine, uiLink } = require('../../lib/ui');
const { projectLogsPrompt } = require('../../lib/prompts/projectsLogsPrompt');
// const { tailLogs } = require('../../lib/serverlessLogs');
const { i18n } = require('../../lib/lang');
// const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.commands.project.subcommands.logs';

const getPrivateAppsUrl = accountId => {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return `${baseUrl}/private-apps/${accountId}`;
};

// We currently cannot fetch logs directly to the CLI. See internal CLI issue #413 for more information.

// const handleLogsError = (e, name, projectName) => {
//   if (e.statusCode === 404) {
//     logger.debug(`Log fetch error: ${e.message}`);
//     logger.log(i18n(`${i18nKey}.logs.noLogsFound`, { name }));
//   } else {
//     logApiErrorInstance(
//       e,
//       new ApiErrorContext({ accountId: getAccountId(), projectName })
//     );
//     process.exit(EXIT_CODES.ERROR);
//   }
// };

// const handleFunctionLog = async (accountId, options) => {
//   const {
//     latest,
//     follow,
//     compact,
//     appPath,
//     functionName,
//     projectName,
//   } = options;

//   let logsResp;

//   const tailCall = async after => {
//     try {
//       return appPath
//         ? getProjectAppFunctionLogs(
//             accountId,
//             functionName,
//             projectName,
//             appPath,
//             {
//               after,
//             }
//           )
//         : getFunctionLogs(accountId, functionName, { after });
//     } catch (e) {
//       handleLogsError(e, functionName, projectName);
//     }
//   };

//   const fetchLatest = async () => {
//     return appPath
//       ? getLatestProjectAppFunctionLog(
//           accountId,
//           functionName,
//           projectName,
//           appPath
//         )
//       : getLatestFunctionLog(accountId, functionName, projectName);
//   };

//   if (follow) {
//     await tailLogs({
//       accountId,
//       compact,
//       tailCall,
//       fetchLatest,
//       name: functionName,
//     });
//   } else if (latest) {
//     try {
//       logsResp = await fetchLatest();
//     } catch (e) {
//       handleLogsError(e, functionName, projectName);
//       return true;
//     }
//   } else {
//     try {
//       logsResp = await tailCall();
//     } catch (e) {
//       handleLogsError(e, functionName, projectName);
//       return true;
//     }
//   }

//   if (logsResp) {
//     outputLogs(logsResp, options);
//     return true;
//   }
//   return false;
// };

exports.command = 'logs [--project] [--app] [--function] [--endpoint]';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

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

  // let relativeAppPath;
  let appId;

  if (appName && !endpointName) {
    await ensureProjectExists(accountId, projectName, {
      allowCreate: false,
    });

    // const { deployedBuild, id: projectId } = await fetchProject(
    //   accountId,
    //   projectName
    // );
    const { id: projectId } = await fetchProject(accountId, projectName);

    const { results: deployComponents } = await fetchDeployComponentsMetadata(
      accountId,
      projectId
    );

    const appComponent = deployComponents.find(
      c => c.componentName === appName
    );

    if (appComponent) {
      appId = appComponent.componentIdentifier;
    }

    // if (deployedBuild && deployedBuild.subbuildStatuses) {
    //   const appSubbuild = deployedBuild.subbuildStatuses.find(
    //     subbuild => subbuild.buildName === appName
    //   );
    //   if (appSubbuild) {
    //     relativeAppPath = appSubbuild.rootPath;
    //   } else {
    //     logger.error(
    //       i18n(`${i18nKey}.errors.invalidAppName`, {
    //         appName: options.app,
    //         projectName,
    //       })
    //     );
    //     process.exit(EXIT_CODES.ERROR);
    //   }
    // }
  }

  trackCommandUsage('project-logs', null, accountId);

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
    appId
      ? uiLink(
          i18n(`${i18nKey}.logs.hubspotLogsDirectLink`),
          `${getPrivateAppsUrl(accountId)}/${appId}/logs/extensions`
        )
      : uiLink(
          i18n(`${i18nKey}.logs.hubspotLogsLink`),
          getPrivateAppsUrl(accountId)
        )
  );
  logger.log();
  uiLine();

  //   const showFinalMessage = await handleFunctionLog(accountId, {
  //     ...options,
  //     projectName,
  //     appPath: relativeAppPath,
  //     functionName: functionName || endpointName,
  //   });

  //   if (showFinalMessage) {
  //     uiLine();
  //   }
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
    .conflicts('tail', 'limit');

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
