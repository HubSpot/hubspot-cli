const { i18n } = require('../lang');
const { fetchProject } = require('@hubspot/cli-lib/api/dfs');
const { promptUser } = require('./promptUtils');
const { getAccountId } = require('../commonOpts');
const { getProjectConfig, ensureProjectExists } = require('../projects');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const { logger } = require('@hubspot/cli-lib/logger');
const { EXIT_CODES } = require('../enums/exitCodes');

const i18nKey = 'cli.lib.prompts.projectLogsPrompt';

const SERVERLESS_FUNCTION_TYPES = {
  APP_FUNCTION: 'app-function',
  PUBLIC_ENDPOINT: 'public-endpoint',
};

const projectLogsPrompt = (accountId, promptOptions = {}) => {
  return promptUser([
    {
      name: 'projectName',
      message: i18n(`${i18nKey}.projectName.message`),
      when: !promptOptions.project,
      default: async () => {
        const { projectConfig } = await getProjectConfig();
        return projectConfig && projectConfig.name ? projectConfig.name : null;
      },
      validate: name =>
        !name.length ? i18n(`${i18nKey}.projectName.error`) : true,
    },
    {
      name: 'logType',
      type: 'list',
      message: i18n(`${i18nKey}.logType.message`),
      when:
        !promptOptions.app &&
        !promptOptions.function &&
        !promptOptions.endpoint,
      choices: [
        {
          name: i18n(`${i18nKey}.logType.function`),
          value: SERVERLESS_FUNCTION_TYPES.APP_FUNCTION,
        },
        {
          name: i18n(`${i18nKey}.logType.endpoint`),
          value: SERVERLESS_FUNCTION_TYPES.PUBLIC_ENDPOINT,
        },
      ],
    },
    {
      name: 'appName',
      type: 'list',
      message: i18n(`${i18nKey}.appName`),
      when: ({ logType }) => {
        return (
          (promptOptions.function ||
            logType === SERVERLESS_FUNCTION_TYPES.APP_FUNCTION) &&
          !promptOptions.app &&
          !promptOptions.endpoint
        );
      },
      choices: async ({ projectName }) => {
        const name = projectName || promptOptions.project;

        try {
          await ensureProjectExists(accountId, name, {
            allowCreate: false,
          });
          const { deployedBuild } = await fetchProject(accountId, name);

          if (deployedBuild && deployedBuild.subbuildStatuses) {
            return deployedBuild.subbuildStatuses
              .filter(subbuild => subbuild.buildType === 'PRIVATE_APP')
              .map(subbuild => ({
                name: subbuild.buildName,
                value: subbuild.buildName,
              }));
          } else {
            logger.debug('Failed to fetch project');
            process.exit(EXIT_CODES.ERROR);
          }
        } catch (e) {
          const { projectConfig } = await getProjectConfig();
          const projectName = projectConfig.name;

          logApiErrorInstance(
            e,
            new ApiErrorContext({ accountId: getAccountId(), projectName })
          );
          process.exit(EXIT_CODES.ERROR);
        }
      },
    },
    {
      name: 'functionName',
      message: i18n(`${i18nKey}.functionName`),
      when: ({ logType }) => {
        return (
          (promptOptions.app ||
            logType === SERVERLESS_FUNCTION_TYPES.APP_FUNCTION) &&
          !promptOptions.function &&
          !promptOptions.endpoint
        );
      },
    },
    {
      name: 'endpointName',
      message: i18n(`${i18nKey}.endpointName`),
      when: ({ logType }) => {
        return (
          logType === SERVERLESS_FUNCTION_TYPES.PUBLIC_ENDPOINT &&
          !promptOptions.function &&
          !promptOptions.endpoint
        );
      },
    },
  ]);
};

module.exports = {
  projectLogsPrompt,
};
