const inquirer = require('inquirer');

const MODULE_LABEL_PROMPT = {
  name: 'moduleLabel',
  message: 'What should the module label be?',
  validate(val) {
    if (typeof val !== 'string') {
      return 'You entered an invalid name. Please try again.';
    } else if (!val.length) {
      return 'The name may not be blank. Please try again.';
    }
    return true;
  },
};
const CONTENT_TYPES_PROMPT = {
  type: 'checkbox',
  name: 'contentTypes',
  message: 'What types of content will this module be used in?',
  default: 'PAGE',
  choices: [
    { name: 'Page', value: 'PAGE' },
    { name: 'Blog post', value: 'BLOG_POST' },
    { name: 'Blog listing', value: 'BLOG_LISTING' },
    { name: 'Email', value: 'EMAIL' },
  ],
};

function createModulePrompt() {
  const prompt = inquirer.createPromptModule();
  return prompt([MODULE_LABEL_PROMPT, CONTENT_TYPES_PROMPT]);
}
module.exports = {
  createModulePrompt,
};
