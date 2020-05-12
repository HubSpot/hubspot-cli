const inquirer = require('inquirer');

const APP_TYPE_PROMPT = {
  type: 'list',
  name: 'endpointMethod',
  message: 'Select output type',
  default: 'Template',
  choices: ['Template', 'Module'],
};

function createReactAppPrompt() {
  const prompt = inquirer.createPromptModule();
  return prompt([APP_TYPE_PROMPT]);
}
module.exports = {
  createReactAppPrompt,
};
