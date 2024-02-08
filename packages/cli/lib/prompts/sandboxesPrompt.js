const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const {
  getSandboxTypeAsString,
  STANDARD_SANDBOX,
  DEVELOPER_SANDBOX,
} = require('../sandboxes');
const { accountNameExistsInConfig } = require('@hubspot/local-dev-lib/config');

const i18nKey = 'cli.lib.prompts.sandboxesPrompt';

const mapSandboxAccountChoices = portals =>
  portals
    .filter(p => p.sandboxAccountType && p.sandboxAccountType !== null)
    .map(p => {
      const sandboxName = `[${getSandboxTypeAsString(
        p.sandboxAccountType
      )} sandbox] `;
      return {
        name: `${p.name} ${sandboxName}(${p.portalId})`,
        value: p.name || p.portalId,
      };
    });

const mapNonSandboxAccountChoices = portals =>
  portals
    .filter(
      p => p.sandboxAccountType === null || p.sandboxAccountType === undefined
    )
    .map(p => {
      return {
        name: `${p.name} (${p.portalId})`,
        value: p.name || p.portalId,
      };
    });

const sandboxNamePrompt = (type = STANDARD_SANDBOX) => {
  const isDeveloperSandbox = type === DEVELOPER_SANDBOX;
  const namePromptMessage = isDeveloperSandbox
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
      default: `New ${isDeveloperSandbox ? 'development ' : ''}sandbox`,
    },
  ]);
};

const sandboxTypeChoices = [
  {
    name: i18n(`${i18nKey}.type.developer`),
    value: 'DEVELOPER',
  },
  {
    name: i18n(`${i18nKey}.type.standard`),
    value: 'STANDARD',
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
      default: 'DEVELOPER',
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
