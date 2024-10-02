const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { uiAccountDescription } = require('../ui');
const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');
const { isSandbox } = require('../accountTypes');

const i18nKey = 'lib.prompts.sandboxesPrompt';

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
          ? `${i18nKey}.selectParentAccountName`
          : `${i18nKey}.selectAccountName`
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
  sandboxTypePrompt,
  deleteSandboxPrompt,
};
