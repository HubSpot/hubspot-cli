const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { fetchProject } = require('@hubspot/cli-lib/api/dfs');
const { promptUser } = require('./promptUtils');
const { getProjectConfig, ensureProjectExists } = require('../projects');
const { logger } = require('@hubspot/cli-lib/logger');
const { EXIT_CODES } = require('../enums/exitCodes');

const i18nKey = 'cli.lib.prompts.projectLogsPrompt';

const projectLogsPrompt = (accountId, promptOptions = {}) => {
  return promptUser([
    {
      name: 'projectName',
      message: i18n(`${i18nKey}.projectName`),
      when: !promptOptions.project,
      default: async () => {
        const { projectConfig } = await getProjectConfig();
        return projectConfig && projectConfig.name ? projectConfig.name : null;
      },
    },
    {
      name: 'appName',
      type: 'list',
      message: i18n(`${i18nKey}.appName`),
      when: !promptOptions.app && !promptOptions.endpoint,
      choices: async ({ projectName }) => {
        const name = projectName || promptOptions.project;

        await ensureProjectExists(accountId, name, {
          allowCreate: false,
        });
        const { deployedBuild } = await fetchProject(accountId, name);

        if (deployedBuild && deployedBuild.subbuildStatuses) {
          return deployedBuild.subbuildStatuses
            .filter(subbuild => subbuild.buildType === 'APP')
            .map(subbuild => ({
              name: subbuild.buildName,
              value: subbuild.buildName,
            }));
        } else {
          logger.debug('Failed to fetch project');
          process.exit(EXIT_CODES.ERROR);
        }
      },
    },
    {
      name: 'functionName',
      message: i18n(`${i18nKey}.functionName`),
      when: !promptOptions.function && !promptOptions.endpoint,
    },
  ]);
};

module.exports = {
  projectLogsPrompt,
};
