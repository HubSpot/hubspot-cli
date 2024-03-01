const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { accountNameExistsInConfig } = require('@hubspot/local-dev-lib/config');
const { uiAccountDescription } = require('../ui');
const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');
const { isSandbox } = require('../sandboxes');

const i18nKey = 'cli.lib.prompts.sandboxesPrompt';

const mapSandboxAccountChoices = portals =>
  portals
    .filter(p => isSandbox(p))
    .map(p => {
      return {
        name: uiAccountDescription(p.portalId, false),
        value: p.name || p.portalId,
      };
    });

const mapNonSandboxAccountChoices = portals =>
  portals
    .filter(p => !isSandbox(p))
    .map(p => {
      return {
        name: `${p.name} (${p.portalId})`,
        value: p.name || p.portalId,
      };
    });

const sandboxNamePrompt = (type = HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX) => {
  const isDevelopmentSandbox =
    type === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX;
  const namePromptMessage = isDevelopmentSandbox
    ? `${i18nKey}.name.developmentSandboxMessage`
    : `${i18nKey}.name.message`;
  return promptUser([
    {
      name: 'name',
      message: i18n(namePromptMessage),
      validate(val) {
        if (typeof val !== 'string') {
          return i18n(`${i18nKey}.name.errors.invalidName`);
        } else if (!val.length) {
          return i18n(`${i18nKey}.name.errors.nameRequired`);
        }
        return accountNameExistsInConfig(val)
          ? i18n(`${i18nKey}.name.errors.accountNameExists`, { name: val })
          : true;
      },
      default: `New ${isDevelopmentSandbox ? 'development ' : ''}sandbox`,
    },
  ]);
};

const sandboxTypeChoices = [
  {
    name: i18n(`${i18nKey}.type.developer`),
    value: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  },
  {
    name: i18n(`${i18nKey}.type.standard`),
    value: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
  },
];

const sandboxTypePrompt = () => {
  return promptUser([
    {
      name: 'type',
      message: i18n(`${i18nKey}.type.message`),
      type: 'list',
      look: false,
      choices: sandboxTypeChoices,
      default: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
    },
  ]);
};

const deleteSandboxPrompt = (config, promptParentAccount = false) => {
  const choices = promptParentAccount
    ? mapNonSandboxAccountChoices(config.portals)
    : mapSandboxAccountChoices(config.portals);
  if (!choices.length) {
    return undefined;
  }
  return promptUser([
    {
      name: 'account',
      message: i18n(
        promptParentAccount
          ? `${i18nKey}.name.selectParentAccountName`
          : `${i18nKey}.name.selectAccountName`
      ),
      type: 'list',
      look: false,
      pageSize: 20,
      choices,
      default: config.defaultPortal,
    },
  ]);
};

module.exports = {
  sandboxNamePrompt,
  sandboxTypePrompt,
  deleteSandboxPrompt,
};
