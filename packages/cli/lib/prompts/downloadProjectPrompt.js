const { promptUser } = require('./promptUtils');
const { getAccountId } = require('@hubspot/local-dev-lib/config');
const { fetchProjects } = require('@hubspot/cli-lib/api/dfs');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const { EXIT_CODES } = require('../enums/exitCodes');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.prompts.downloadProjectPrompt';

const createProjectsList = async () => {
  const accountId = getAccountId();

  try {
    const projects = await fetchProjects(accountId);
    return projects.results;
  } catch (e) {
    logApiErrorInstance(e, new ApiErrorContext({ accountId }));
    process.exit(EXIT_CODES.ERROR);
  }
};

const downloadProjectPrompt = async (promptOptions = {}) => {
  const projectsList = await createProjectsList();

  return promptUser([
    {
      name: 'project',
      message: () => {
        return promptOptions.project &&
          !projectsList.find(p => p.name === promptOptions.name)
          ? i18n(`${i18nKey}.errors.projectNotFound`, {
              projectName: promptOptions.project,
              accountId: getAccountId(),
            })
          : i18n(`${i18nKey}.selectProject`);
      },
      when:
        !promptOptions.project ||
        !projectsList.find(p => p.name === promptOptions.project),
      type: 'list',
      choices: projectsList.map(project => {
        return {
          name: project.name,
          value: project.name,
        };
      }),
    },
  ]);
};

module.exports = {
  downloadProjectPrompt,
};
