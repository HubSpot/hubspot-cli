const inquirer = require('inquirer');
const { PROJECT_TEMPLATE_TYPES } = require('@hubspot/cli-lib/lib/constants');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.lib.prompts.projects';

const createProjectPrompt = (promptOptions = {}) => {
  const prompt = inquirer.createPromptModule();
  return prompt([
    {
      type: 'list',
      name: 'template',
      message: i18n(`${i18nKey}.selectTemplate`),
      default: PROJECT_TEMPLATE_TYPES.blank,
      choices: Object.keys(PROJECT_TEMPLATE_TYPES),
    },
    {
      name: 'label',
      message: i18n(`${i18nKey}.enterLabel`),
      validate(val) {
        if (typeof val !== 'string') {
          return i18n(`${i18nKey}.errors.invalidLabel`);
        }
        return true;
      },
      default: promptOptions.label || 'New project',
    },
    {
      name: 'description',
      message: i18n(`${i18nKey}.enterDescription`),
      validate(val) {
        if (typeof val !== 'string') {
          return i18n(`${i18nKey}.errors.invalidDescription`);
        }
        return true;
      },
    },
  ]);
};

module.exports = {
  createProjectPrompt,
};
