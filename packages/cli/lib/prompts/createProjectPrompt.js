const path = require('path');
const { getCwd } = require('@hubspot/cli-lib/path');
const {
  PROJECT_COMPONENT_TYPES,
  PROJECT_PROPERTIES,
} = require('@hubspot/cli-lib/lib/constants');
const { promptUser } = require('./promptUtils');
const { fetchJsonFromRepository } = require('@hubspot/cli-lib/github');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');

const i18nKey = 'cli.lib.prompts.createProjectPrompt';

const hasAllProperties = projectList => {
  return projectList.every(config =>
    PROJECT_PROPERTIES.every(p =>
      Object.prototype.hasOwnProperty.call(config, p)
    )
  );
};

const createTemplateOptions = async repoPath => {
  const isRepoPath = !!repoPath;
  const config = await fetchJsonFromRepository(
    repoPath,
    'main/config.json',
    isRepoPath
  );

  if (!config[PROJECT_COMPONENT_TYPES.PROJECTS]) {
    return logger.error(i18n(`${i18nKey}.errors.noProjectsInConfig`));
  }

  if (!hasAllProperties(config[PROJECT_COMPONENT_TYPES.PROJECTS])) {
    return logger.error(i18n(`${i18nKey}.errors.missingPropertiesInConfig`));
  }

  return config[PROJECT_COMPONENT_TYPES.PROJECTS];
};

const createProjectPrompt = async (promptOptions = {}) => {
  const projectTemplates = await createTemplateOptions(promptOptions.repoPath);

  return promptUser([
    {
      name: 'name',
      message: i18n(`${i18nKey}.enterName`),
      when: !promptOptions.name,
      validate: input => {
        if (!input) {
          return i18n(`${i18nKey}.errors.nameRequired`);
        }
        return true;
      },
    },
    {
      name: 'location',
      message: i18n(`${i18nKey}.enterLocation`),
      when: !promptOptions.location,
      default: answers => {
        return path.resolve(getCwd(), answers.name || promptOptions.name);
      },
      validate: input => {
        if (!input) {
          return i18n(`${i18nKey}.errors.locationRequired`);
        }
        return true;
      },
    },
    {
      name: 'template',
      message: () => {
        return promptOptions.template &&
          !projectTemplates.find(t => t.name === promptOptions.template)
          ? i18n(`${i18nKey}.errors.invalidTemplate`, {
              template: promptOptions.template,
            })
          : i18n(`${i18nKey}.selectTemplate`);
      },
      when:
        !promptOptions.template ||
        !projectTemplates.find(t => t.name === promptOptions.template),
      type: 'list',
      choices: projectTemplates.map(template => {
        return {
          name: template.label,
          value: template,
        };
      }),
    },
  ]);
};

module.exports = {
  createProjectPrompt,
};
