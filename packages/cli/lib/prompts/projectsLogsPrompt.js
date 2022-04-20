const { getCwd } = require('@hubspot/cli-lib/path');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { promptUser } = require('./promptUtils');
const { getProjectConfig, getProjectComponents } = require('../projects');

const i18nKey = 'cli.lib.prompts.projectLogsPrompt';

const projectLogsPrompt = (promptOptions = {}) => {
  return promptUser([
    {
      name: 'projectName',
      message: i18n(`${i18nKey}.projectName`),
      when: !promptOptions.project,
      default: async () => {
        const { projectConfig } = await getProjectConfig(getCwd());
        return projectConfig && projectConfig.name ? projectConfig.name : null;
      },
    },
    {
      name: 'appName',
      type: 'list',
      message: i18n(`${i18nKey}.appName`),
      when: !promptOptions.app && !promptOptions.endpoint,
      choices: async () => {
        const projectComponents = await getProjectComponents();
        return projectComponents.map(component => ({
          name: component.name,
          value: component.name,
        }));
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
