// @ts-nocheck
const fs = require('fs');
const path = require('path');
const {
  getCwd,
  sanitizeFileName,
  isValidPath,
  untildify,
} = require('@hubspot/local-dev-lib/path');
const { PROJECT_COMPONENT_TYPES } = require('../constants');
const { promptUser } = require('./promptUtils');
const { fetchFileFromRepository } = require('@hubspot/local-dev-lib/github');
const { i18n } = require('../lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { EXIT_CODES } = require('../enums/exitCodes');
const {
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
} = require('../constants');

const i18nKey = 'lib.prompts.createProjectPrompt';

const PROJECT_PROPERTIES = ['name', 'label', 'path', 'insertPath'];

const hasAllProperties = projectList => {
  return projectList.every(config =>
    PROJECT_PROPERTIES.every(p =>
      Object.prototype.hasOwnProperty.call(config, p)
    )
  );
};

const createTemplateOptions = async (templateSource, githubRef) => {
  const hasCustomTemplateSource = Boolean(templateSource);
  const branch = hasCustomTemplateSource
    ? DEFAULT_PROJECT_TEMPLATE_BRANCH
    : githubRef;

  const config = await fetchFileFromRepository(
    templateSource || HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
    'config.json',
    branch
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

function findTemplate(projectTemplates, templateNameOrLabel) {
  return projectTemplates.find(
    t => t.name === templateNameOrLabel || t.label === templateNameOrLabel
  );
}

const createProjectPrompt = async (
  githubRef,
  promptOptions = {},
  skipTemplatePrompt = false
) => {
  let projectTemplates = [];
  let selectedTemplate;

  if (!skipTemplatePrompt) {
    projectTemplates = await createTemplateOptions(
      promptOptions.templateSource,
      githubRef
    );

    selectedTemplate =
      promptOptions.template &&
      findTemplate(projectTemplates, promptOptions.template);
  }

  const result = await promptUser([
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
      name: 'dest',
      message: i18n(`${i18nKey}.enterDest`),
      when: !promptOptions.dest,
      default: answers => {
        const projectName = sanitizeFileName(
          answers.name || promptOptions.name
        );
        return path.resolve(getCwd(), projectName);
      },
      validate: input => {
        if (!input) {
          return i18n(`${i18nKey}.errors.destRequired`);
        }
        if (fs.existsSync(input)) {
          return i18n(`${i18nKey}.errors.invalidDest`);
        }
        if (!isValidPath(input)) {
          return i18n(`${i18nKey}.errors.invalidCharacters`);
        }
        return true;
      },
      filter: input => {
        return untildify(input);
      },
    },
    {
      name: 'template',
      message: () => {
        return promptOptions.template &&
          !findTemplate(projectTemplates, promptOptions.template)
          ? i18n(`${i18nKey}.errors.invalidTemplate`, {
              template: promptOptions.template,
            })
          : i18n(`${i18nKey}.selectTemplate`);
      },
      when: !skipTemplatePrompt && !selectedTemplate,
      type: 'list',
      choices: projectTemplates.map(template => {
        return {
          name: template.label,
          value: template,
        };
      }),
    },
  ]);

  if (selectedTemplate) {
    result.template = selectedTemplate;
  }

  return result;
};

module.exports = {
  createProjectPrompt,
};
