const inquirer = require('inquirer');
const { PROJECT_TEMPLATE_TYPES } = require('@hubspot/cli-lib/lib/constants');

const createProjectPrompt = (promptOptions = {}) => {
  const prompt = inquirer.createPromptModule();
  return prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Select a project template to use',
      default: PROJECT_TEMPLATE_TYPES.blank,
      choices: Object.keys(PROJECT_TEMPLATE_TYPES),
    },
    {
      name: 'label',
      message: 'Enter a label for the project',
      validate(val) {
        if (typeof val !== 'string') {
          return 'You entered an invalid label. Please try again.';
        }
        return true;
      },
      default: promptOptions.label || 'New project',
    },
    {
      name: 'description',
      message: 'Enter a description for the project',
      validate(val) {
        if (typeof val !== 'string') {
          return 'You entered an invalid description. Please try again.';
        }
        return true;
      },
    },
  ]);
};

module.exports = {
  createProjectPrompt,
};
