const inquirer = require('inquirer');

const TEMPLATE_TYPE_PROMPT = {
  type: 'list',
  name: 'templateType',
  message: 'Select the type of template to create',
  default: 'PAGE',
  choices: [
    { name: 'PAGE', value: 'page-template' },
    { name: 'EMAIL', value: 'email-template' },
  ],
};

function createTemplatePrompt() {
  const prompt = inquirer.createPromptModule();
  return prompt([TEMPLATE_TYPE_PROMPT]);
}
module.exports = {
  createTemplatePrompt,
};
