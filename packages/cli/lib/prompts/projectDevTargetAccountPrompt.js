const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { uiAccountDescription, uiCommandReference } = require('../ui');
const { isSandbox } = require('../accountTypes');
const { getAccountId } = require('@hubspot/local-dev-lib/config');
const {
  getSandboxUsageLimits,
} = require('@hubspot/local-dev-lib/api/sandboxHubs');
const {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} = require('@hubspot/local-dev-lib/constants/config');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  fetchDeveloperTestAccounts,
} = require('@hubspot/local-dev-lib/api/developerTestAccounts');

const i18nKey = 'lib.prompts.projectDevTargetAccountPrompt';

const mapNestedAccount = accountConfig => ({
  name: uiAccountDescription(accountConfig.portalId, false),
  value: {
    targetAccountId: getAccountId(accountConfig.name),
    createNestedAccount: false,
    parentAccountId: accountConfig.parentAccountId,
  },
});

const getNonConfigDeveloperTestAccountName = account => {
  return `${account.accountName} [${
    HUBSPOT_ACCOUNT_TYPE_STRINGS[HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST]
  }] (${account.id})`;
};

const selectSandboxTargetAccountPrompt = async (
  accounts,
  defaultAccountConfig
) => {
  const defaultAccountId = getAccountId(defaultAccountConfig.name);
  let choices = [];
  let sandboxUsage = {};
  try {
    const { data } = await getSandboxUsageLimits(defaultAccountId);
    sandboxUsage = data.usage;
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
  choices = [
    ...sandboxAccounts
      .filter(a => a.accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX)
      .map(mapNestedAccount),
    ...sandboxAccounts
      .filter(a => a.accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX)
      .map(mapNestedAccount),
    {
      name: i18n(`${i18nKey}.createNewSandboxOption`),
      value: {
        targetAccountId: null,
        createNestedAccount: true,
      },
      disabled: disabledMessage,
    },
    {
      name: i18n(`${i18nKey}.chooseDefaultAccountOption`),
      value: {
        targetAccountId: defaultAccountId,
        createNestedAccount: false,
      },
    },
  ];

  return selectTargetAccountPrompt(
    defaultAccountId,
    'sandbox account',
    choices
  );
};

const selectDeveloperTestTargetAccountPrompt = async (
  accounts,
  defaultAccountConfig
) => {
  const defaultAccountId = getAccountId(defaultAccountConfig.name);
  let devTestAccountsResponse = undefined;
  try {
    const { data } = await fetchDeveloperTestAccounts(defaultAccountId);
    devTestAccountsResponse = data;
  } catch (err) {
    logger.debug('Unable to fetch developer test account usage limits: ', err);
  }

  let disabledMessage = false;
  if (
    devTestAccountsResponse &&
    devTestAccountsResponse.results.length >=
      devTestAccountsResponse.maxTestPortals
  ) {
    disabledMessage = i18n(`${i18nKey}.developerTestAccountLimit`, {
      authCommand: uiCommandReference('hs auth'),
      limit: devTestAccountsResponse.maxTestPortals,
    });
  }

  const devTestAccounts = [];
  if (devTestAccountsResponse && devTestAccountsResponse.results) {
    const accountIds = accounts.map(account => account.portalId);

    devTestAccountsResponse.results.forEach(acct => {
      const inConfig = accountIds.includes(acct.id);
      devTestAccounts.push({
        name: getNonConfigDeveloperTestAccountName(acct),
        value: {
          targetAccountId: acct.id,
          createdNestedAccount: false,
          parentAccountId: defaultAccountId,
          notInConfigAccount: inConfig ? null : acct,
        },
      });
    });
  }

  const choices = [
    ...devTestAccounts,
    {
      name: i18n(`${i18nKey}.createNewDeveloperTestAccountOption`),
      value: {
        targetAccountId: null,
        createNestedAccount: true,
      },
      disabled: disabledMessage,
    },
  ];

  return selectTargetAccountPrompt(
    defaultAccountId,
    HUBSPOT_ACCOUNT_TYPE_STRINGS[HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST],
    choices
  );
};

const selectTargetAccountPrompt = async (
  defaultAccountId,
  accountType,
  choices
) => {
  const { targetAccountInfo } = await promptUser([
    {
      name: 'targetAccountInfo',
      type: 'list',
      message: i18n(`${i18nKey}.promptMessage`, {
        accountIdentifier: uiAccountDescription(defaultAccountId),
        accountType,
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

const confirmUseExistingDeveloperTestAccountPrompt = async account => {
  const { confirmUseExistingDeveloperTestAccount } = await promptUser([
    {
      name: 'confirmUseExistingDeveloperTestAccount',
      type: 'confirm',
      message: i18n(`${i18nKey}.confirmUseExistingDeveloperTestAccount`, {
        accountName: getNonConfigDeveloperTestAccountName(account),
      }),
    },
  ]);
  return confirmUseExistingDeveloperTestAccount;
};

module.exports = {
  selectSandboxTargetAccountPrompt,
  selectDeveloperTestTargetAccountPrompt,
  confirmDefaultAccountPrompt,
  confirmUseExistingDeveloperTestAccountPrompt,
};
