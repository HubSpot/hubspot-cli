const path = require('path');
const { getCwd } = require('@hubspot/cli-lib/path');
const { promptUser } = require('./promptUtils');
const { getIsInProject } = require('../projects');
const { fetchJsonFromRepository } = require('@hubspot/cli-lib/github');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.lib.prompts.projectComponentsPrompt';

const createTemplateOptions = async () => {
  const config = await fetchJsonFromRepository(
    'hubspot-project-components',
    'main/config.json'
  );
  return config.components;
};

const projectComponentsPrompt = async (promptOptions = {}) => {
  const componentTemplates = await createTemplateOptions();
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
        return path.resolve(
          getCwd(),
          `${answers.name}.md` || `${promptOptions.name}.md`
        );
      },
      validate: input => {
        if (!input) {
          return i18n(`${i18nKey}.errors.locationRequired`);
        }
        if (!getIsInProject(input)) {
          return i18n(`${i18nKey}.errors.locationInProject`);
        }
        return true;
      },
    },
    {
      name: 'template',
      message: () => {
        return promptOptions.template &&
          !componentTemplates.find(t => t.path === promptOptions.template)
          ? i18n(`${i18nKey}.errors.invalidTemplate`, {
              template: promptOptions.template,
            })
          : i18n(`${i18nKey}.selectTemplate`);
      },
      when:
        !promptOptions.template ||
        !componentTemplates.find(t => t.path === promptOptions.template),
      type: 'list',
      choices: componentTemplates.map(template => {
        return {
          name: template.label,
          value: template.path,
        };
      }),
    },
  ]);
};

module.exports = {
  projectComponentsPrompt,
};
