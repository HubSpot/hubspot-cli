const inquirer = require('inquirer');

const promptUser = async promptConfig => {
  const prompt = inquirer.createPromptModule();
  return prompt(promptConfig);
};

const confirmPrompt = async (message, defaultAnswer = true) => {
  const { choice } = await promptUser([
    {
      name: 'choice',
      type: 'confirm',
      default: defaultAnswer,
      message,
    },
  ]);
  return choice;
};

module.exports = {
  promptUser,
  confirmPrompt,
};
