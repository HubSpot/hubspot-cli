const inquirer = require('inquirer');
const { PROJECT_TEMPLATE_TYPES } = require('@hubspot/cli-lib/lib/constants');

const createProjectPrompt = (promptOptions = {}) => {
  const prompt = inquirer.createPromptModule();
  return prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Select a project template to use',
      default: 'blank',
      choices: PROJECT_TEMPLATE_TYPES,
    },
    {
      name: 'name',
      message: 'Enter a name for the project',
      validate(val) {
        if (typeof val !== 'string') {
          return 'You entered an invalid description. Please try again.';
        }
        return true;
      },
      default: promptOptions.name || 'New project',
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
