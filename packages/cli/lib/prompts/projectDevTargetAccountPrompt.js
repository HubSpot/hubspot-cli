const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { uiAccountDescription, uiCommandReference } = require('../ui');
const { isSandbox } = require('../sandboxes');
const { getAccountId } = require('@hubspot/local-dev-lib/config');
const { getSandboxUsageLimits } = require('@hubspot/local-dev-lib/sandboxes');
const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');
const { logger } = require('@hubspot/local-dev-lib/logger');

const i18nKey = 'cli.lib.prompts.projectDevTargetAccountPrompt';

const mapSandboxAccount = accountConfig => ({
  name: uiAccountDescription(accountConfig.portalId, false),
  value: {
    targetAccountId: getAccountId(accountConfig.name),
    createNewSandbox: false,
  },
});

const selectTargetAccountPrompt = async (accounts, defaultAccountConfig) => {
  let sandboxUsage = {};
  const defaultAccountId = getAccountId(defaultAccountConfig.name);

  try {
    sandboxUsage = await getSandboxUsageLimits(defaultAccountId);
  } catch (err) {
    logger.debug('Unable to fetch sandbox usage limits: ', err);
  }

  const sandboxAccounts = accounts
    .reverse()
    .filter(
      config => isSandbox(config) && config.parentAccountId === defaultAccountId
    );
  let disabledMessage = false;

  if (sandboxUsage['DEVELOPER'] && sandboxUsage['DEVELOPER'].available === 0) {
    if (sandboxAccounts.length < sandboxUsage['DEVELOPER'].limit) {
      disabledMessage = i18n(`${i18nKey}.sandboxLimitWithSuggestion`, {
        authCommand: uiCommandReference('hs auth'),
        limit: sandboxUsage['DEVELOPER'].limit,
      });
    } else {
      disabledMessage = i18n(`${i18nKey}.sandboxLimit`, {
        limit: sandboxUsage['DEVELOPER'].limit,
      });
    }
  }

  // Order choices by Developer Sandbox -> Standard Sandbox
  const choices = [
    ...sandboxAccounts
      .filter(a => a.accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX)
      .map(mapSandboxAccount),
    ...sandboxAccounts
      .filter(a => a.accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX)
      .map(mapSandboxAccount),
    {
      name: i18n(`${i18nKey}.createNewSandboxOption`),
      value: {
        targetAccountId: null,
        createNewSandbox: true,
      },
      disabled: disabledMessage,
    },
    {
      name: i18n(`${i18nKey}.chooseDefaultAccountOption`),
      value: {
        targetAccountId: defaultAccountId,
        createNewSandbox: false,
      },
    },
  ];

  const { targetAccountInfo } = await promptUser([
    {
      name: 'targetAccountInfo',
      type: 'list',
      message: i18n(`${i18nKey}.promptMessage`, {
        accountIdentifier: uiAccountDescription(defaultAccountId),
      }),
      choices,
    },
  ]);

  return targetAccountInfo;
};

const confirmDefaultAccountPrompt = async (accountName, accountType) => {
  const { useDefaultAccount } = await promptUser([
    {
      name: 'useDefaultAccount',
      type: 'confirm',
      message: i18n(`${i18nKey}.confirmDefaultAccount`, {
        accountName,
        accountType,
      }),
    },
  ]);
  return useDefaultAccount;
};

module.exports = {
  selectTargetAccountPrompt,
  confirmDefaultAccountPrompt,
};
