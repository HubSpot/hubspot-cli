const inquirer = require('inquirer');

const SECRET_VALUE_PROMPT = {
  name: 'secretValue',
  type: 'password',
  message: 'Enter a value for your secret',
  validate(val) {
    if (typeof val !== 'string') {
      return 'You entered an invalid value. Please try again.';
    }
    return true;
  },
};

function secretValuePrompt() {
  const prompt = inquirer.createPromptModule();
  return prompt([SECRET_VALUE_PROMPT]);
}
module.exports = {
  secretValuePrompt,
};
