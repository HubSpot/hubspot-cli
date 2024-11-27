// @ts-nocheck
const {
  getConfigDefaultAccount,
  getConfigAccounts,
} = require('@hubspot/local-dev-lib/config');
const {
  getAccountIdentifier,
} = require('@hubspot/local-dev-lib/config/getAccountIdentifier');
const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { uiAccountDescription } = require('../ui');

const mapAccountChoices = portals =>
  portals.map(p => ({
    name: uiAccountDescription(getAccountIdentifier(p), false),
    value: p.name || getAccountIdentifier(p),
  }));

const i18nKey = 'commands.account.subcommands.use';

const selectAccountFromConfig = async (config, prompt) => {
  const accountsList = getConfigAccounts();
  const defaultAccount = getConfigDefaultAccount(config);

  const { default: selectedDefault } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'default',
      pageSize: 20,
      message: prompt || i18n(`${i18nKey}.promptMessage`),
      choices: mapAccountChoices(accountsList),
      default: defaultAccount,
    },
  ]);

  return selectedDefault;
};

module.exports = {
  selectAccountFromConfig,
};
