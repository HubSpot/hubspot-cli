const inquirer = require('inquirer');

const TEMPLATE_TYPE_PROMPT = {
  type: 'list',
  name: 'templateType',
  message: 'Select the type of template to create',
  default: 'page',
  choices: [
    { name: 'page', value: 'page-template' },
    { name: 'email', value: 'email-template' },
    { name: 'partial', value: 'partial' },
    { name: 'global partial', value: 'global-partial' },
    { name: 'blog listing', value: 'blog-listing-template' },
    { name: 'blog post', value: 'blog-post-template' },
    { name: 'search results', value: 'search-template' },
  ],
};

function createTemplatePrompt() {
  const prompt = inquirer.createPromptModule();
  return prompt([TEMPLATE_TYPE_PROMPT]);
}
module.exports = {
  createTemplatePrompt,
};
