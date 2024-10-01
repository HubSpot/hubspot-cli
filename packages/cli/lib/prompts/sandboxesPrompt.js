const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { uiAccountDescription } = require('../ui');
const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');
const {
  getAccountIdentifier,
} = require('@hubspot/local-dev-lib/config/getAccountIdentifier');
const { isSandbox } = require('../accountTypes');
const {
  getDefaultAccount,
  getAccounts,
} = require('@hubspot/local-dev-lib/config');

const i18nKey = 'lib.prompts.sandboxesPrompt';

const mapSandboxAccountChoices = portals =>
  portals
    .filter(p => isSandbox(p))
    .map(p => {
      return {
        name: uiAccountDescription(getAccountIdentifier(p), false),
        value: p.name || p.portalId || p.accountId,
      };
    });

const mapNonSandboxAccountChoices = portals =>
  portals
    .filter(p => !isSandbox(p))
    .map(p => {
      return {
        name: `${p.name} (${getAccountIdentifier(p)})`,
        value: p.name || p.portalId || p.accountId,
      };
    });

const sandboxTypePrompt = () => {
  return promptUser([
    {
      name: 'type',
      message: i18n(`${i18nKey}.type.message`),
      type: 'list',
      look: false,
      choices: [
        {
          name: i18n(`${i18nKey}.type.developer`),
          value: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
        },
        {
          name: i18n(`${i18nKey}.type.standard`),
          value: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
        },
      ],
      default: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
    },
  ]);
};

const deleteSandboxPrompt = (config, promptParentAccount = false) => {
  const accountsList = getAccounts();
  const choices = promptParentAccount
    ? mapNonSandboxAccountChoices(accountsList)
    : mapSandboxAccountChoices(accountsList);
  if (!choices.length) {
    return undefined;
  }
  return promptUser([
    {
      name: 'account',
      message: i18n(
        promptParentAccount
          ? `${i18nKey}.selectParentAccountName`
          : `${i18nKey}.selectAccountName`
      ),
      type: 'list',
      look: false,
      pageSize: 20,
      choices,
      default: getDefaultAccount(config),
    },
  ]);
};

module.exports = {
  sandboxTypePrompt,
  deleteSandboxPrompt,
};
