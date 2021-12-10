const inquirer = require('inquirer');

const promptUser = async promptConfig => {
  const prompt = inquirer.createPromptModule();
  return prompt(promptConfig);
};

module.exports = {
  promptUser,
};
