const { promptUser } = require('./promptUtils');
const { getAccountId } = require('@hubspot/cli-lib/lib/config');
const { fetchProjects } = require('@hubspot/cli-lib/api/dfs');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.lib.prompts.downloadProjectPrompt';

const createProjectsList = async () => {
  const projects = await fetchProjects(getAccountId());
  return projects.results;
};

const downloadProjectPrompt = async (promptOptions = {}) => {
  const projectsList = await createProjectsList();

  return promptUser([
    {
      name: 'name',
      message: () => {
        return promptOptions.name &&
          !projectsList.find(p => p.name === promptOptions.name)
          ? i18n(`${i18nKey}.errors.projectNotFound`, {
              projectName: promptOptions.name,
              accountId: getAccountId(),
            })
          : i18n(`${i18nKey}.selectProject`);
      },
      when:
        !promptOptions.name ||
        !projectsList.find(p => p.name === promptOptions.name),
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
