const {
  getConfig,
  updateDefaultAccount,
} = require('@hubspot/local-dev-lib/config');
const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.prompts.setAsDefaultAccountPrompt';

const setAsDefaultAccountPrompt = async accountName => {
  const config = getConfig();

  const { setAsDefault } = await promptUser([
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
