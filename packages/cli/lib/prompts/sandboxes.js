const inquirer = require('inquirer');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.lib.prompts.sandboxes';

const createSandbox = () => {
  const prompt = inquirer.createPromptModule();
  return prompt([
    {
      name: 'name',
      message: i18n(`${i18nKey}.enterName`),
      validate(val) {
        if (typeof val !== 'string') {
          return i18n(`${i18nKey}.errors.invalidName`);
        }
        return true;
      },
      default: 'New sandbox',
    },
  ]);
};

module.exports = {
  createSandbox,
};
