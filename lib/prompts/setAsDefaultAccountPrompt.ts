// @ts-nocheck
import inquirer from 'inquirer';
const {
  getConfig,
  updateDefaultAccount,
} = require('@hubspot/local-dev-lib/config');
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.setAsDefaultAccountPrompt';

const setAsDefaultAccountPrompt = async accountName => {
  const config = getConfig();

  const { setAsDefault } = await inquirer.prompt([
    {
      name: 'setAsDefault',
      type: 'confirm',
      when: config.defaultPortal !== accountName,
      message: i18n(`${i18nKey}.setAsDefaultAccountMessage`),
    },
  ]);

  if (setAsDefault) {
    updateDefaultAccount(accountName);
  }
  return setAsDefault;
};

module.exports = {
  setAsDefaultAccountPrompt,
};
