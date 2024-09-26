const { updateDefaultAccount } = require('@hubspot/local-dev-lib/config');
const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { uiAccountDescription } = require('../ui');
const {
  getAccounts,
  getAccountIdentifier,
  getDefaultAccount,
} = require('@hubspot/local-dev-lib/utils/getAccountIdentifier');

const mapAccountChoices = portals =>
  portals.map(p => ({
    name: uiAccountDescription(getAccountIdentifier(p), false),
    value: p.name || p.portalId || p.accountId,
  }));

const i18nKey = 'commands.accounts.subcommands.use';

const selectAccountFromConfig = async (config, prompt) => {
  const accountsList = getAccounts(config);
  const defaultAccount = getDefaultAccount(config);

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

const selectAndSetAsDefaultAccountPrompt = async config => {
  const accountsList = getAccounts(config);
  const defaultAccount = getDefaultAccount(config);

  const { default: selectedDefault } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'default',
      pageSize: 20,
      message: i18n(`${i18nKey}.promptMessage`),
      choices: mapAccountChoices(accountsList),
      default: defaultAccount,
    },
  ]);
  updateDefaultAccount(selectedDefault);
};

module.exports = {
  selectAndSetAsDefaultAccountPrompt,
  selectAccountFromConfig,
  mapAccountChoices,
};
