const {
  getConfig,
  updateDefaultAccount,
} = require('@hubspot/local-dev-lib/config');
const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const {
  getDefaultAccount,
} = require('@hubspot/local-dev-lib/utils/getAccountIdentifier');

const i18nKey = 'lib.prompts.setAsDefaultAccountPrompt';

const setAsDefaultAccountPrompt = async accountName => {
  const config = getConfig();
  // Accounts for deprecated and new config
  const defaultAccount = getDefaultAccount(config);

  const { setAsDefault } = await promptUser([
    {
      name: 'setAsDefault',
      type: 'confirm',
      when: defaultAccount !== accountName,
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
