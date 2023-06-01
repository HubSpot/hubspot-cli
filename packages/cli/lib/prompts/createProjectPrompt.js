const path = require('path');
const { getCwd } = require('@hubspot/cli-lib/path');
const {
  PROJECT_COMPONENT_TYPES,
  PROJECT_PROPERTIES,
} = require('@hubspot/cli-lib/lib/constants');
const { promptUser } = require('./promptUtils');
const { fetchJsonFromRepository } = require('@hubspot/cli-lib/github');
const { i18n } = require('../lang');
const { logger } = require('@hubspot/cli-lib/logger');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.lib.prompts.createProjectPrompt';

const hasAllProperties = projectList => {
  return projectList.every(config =>
    PROJECT_PROPERTIES.every(p =>
      Object.prototype.hasOwnProperty.call(config, p)
    )
  );
};

const createTemplateOptions = async templateSource => {
  const isTemplateSource = !!templateSource;
  const config = await fetchJsonFromRepository(
    templateSource,
    'main/config.json',
    isTemplateSource
  );

  if (!config || !config[PROJECT_COMPONENT_TYPES.PROJECTS]) {
    logger.error(i18n(`${i18nKey}.errors.noProjectsInConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  if (!hasAllProperties(config[PROJECT_COMPONENT_TYPES.PROJECTS])) {
    logger.error(i18n(`${i18nKey}.errors.missingPropertiesInConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  return config[PROJECT_COMPONENT_TYPES.PROJECTS];
};

const createProjectPrompt = async (promptOptions = {}) => {
  const projectTemplates = await createTemplateOptions(
    promptOptions.templateSource
  );

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
