import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { uiAccountDescription, uiCommandReference } from '../ui';
import { isSandbox } from '../accountTypes';
import { getSandboxUsageLimits } from '@hubspot/local-dev-lib/api/sandboxHubs';
import {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} from '@hubspot/local-dev-lib/constants/config';
import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchDeveloperTestAccounts } from '@hubspot/local-dev-lib/api/developerTestAccounts';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { Usage } from '@hubspot/local-dev-lib/types/Sandbox';
import {
  DeveloperTestAccount,
  FetchDeveloperTestAccountsResponse,
} from '@hubspot/local-dev-lib/types/developerTestAccounts';
import {
  PromptChoices,
  ProjectDevTargetAccountPromptResponse,
} from '../../types/Prompts';
import { EXIT_CODES } from '../enums/exitCodes';

const i18nKey = 'lib.prompts.projectDevTargetAccountPrompt';

function mapNestedAccount(account: HubSpotConfigAccount): {
  name: string;
  value: {
    targetAccountId: number | null;
    createNestedAccount: boolean;
    parentAccountId: number | null;
  };
} {
  const parentAccountId = account.parentAccountId ?? null;
  return {
    name: uiAccountDescription(account.accountId, false),
    value: {
      targetAccountId: account.accountId,
      createNestedAccount: false,
      parentAccountId,
    },
  };
}

function getNonConfigDeveloperTestAccountName(
  account: DeveloperTestAccount
): string {
  return `${account.accountName} [${
    HUBSPOT_ACCOUNT_TYPE_STRINGS[HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST]
  }] (${account.id})`;
}

export async function selectSandboxTargetAccountPrompt(
  accounts: HubSpotConfigAccount[],
  defaultAccount: HubSpotConfigAccount
): Promise<ProjectDevTargetAccountPromptResponse> {
  const defaultAccountId = defaultAccount.accountId;
  let choices = [];
  let sandboxUsage: Usage = {
    STANDARD: { used: 0, available: 0, limit: 0 },
    DEVELOPER: { used: 0, available: 0, limit: 0 },
  };
  try {
    if (defaultAccountId) {
      const { data } = await getSandboxUsageLimits(defaultAccountId);
      sandboxUsage = data.usage;
    } else {
      logger.error(`${i18nKey}.noAccountId`);
      process.exit(EXIT_CODES.ERROR);
    }
  } catch (err) {
    logger.debug('Unable to fetch sandbox usage limits: ', err);
  }

  const sandboxAccounts = accounts
    .reverse()
    .filter(
      config => isSandbox(config) && config.parentAccountId === defaultAccountId
    );
  let disabledMessage: string | boolean = false;

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
}

export async function selectDeveloperTestTargetAccountPrompt(
  accounts: HubSpotConfigAccount[],
  defaultAccount: HubSpotConfigAccount
): Promise<ProjectDevTargetAccountPromptResponse> {
  const defaultAccountId = defaultAccount.accountId;
  let devTestAccountsResponse: FetchDeveloperTestAccountsResponse | undefined;
  try {
    if (defaultAccountId) {
      const { data } = await fetchDeveloperTestAccounts(defaultAccountId);
      devTestAccountsResponse = data;
    } else {
      logger.error(`${i18nKey}.noAccountId`);
      process.exit(EXIT_CODES.ERROR);
    }
  } catch (err) {
    logger.debug('Unable to fetch developer test account usage limits: ', err);
  }

  let disabledMessage: string | boolean = false;
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

  const devTestAccounts: PromptChoices = [];
  if (devTestAccountsResponse && devTestAccountsResponse.results) {
    const accountIds = accounts.map(account => account.accountId);

    devTestAccountsResponse.results.forEach(acct => {
      const inConfig = accountIds.includes(acct.id);
      devTestAccounts.push({
        name: getNonConfigDeveloperTestAccountName(acct),
        value: {
          targetAccountId: acct.id,
          createNestedAccount: false,
          parentAccountId: defaultAccountId ?? null,
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
}

async function selectTargetAccountPrompt(
  defaultAccountId: number | null,
  accountType: string,
  choices: PromptChoices
): Promise<ProjectDevTargetAccountPromptResponse> {
  const accountId = defaultAccountId;
  const { targetAccountInfo } = await promptUser<{
    targetAccountInfo: ProjectDevTargetAccountPromptResponse;
  }>([
    {
      name: 'targetAccountInfo',
      type: 'list',
      message: i18n(`${i18nKey}.promptMessage`, {
        accountIdentifier: uiAccountDescription(accountId),
        accountType,
      }),
      choices,
    },
  ]);

  return targetAccountInfo;
}

export async function confirmDefaultAccountPrompt(
  accountName: string,
  accountType: string
): Promise<boolean> {
  const { useDefaultAccount } = await promptUser<{
    useDefaultAccount: boolean;
  }>([
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
}

export async function confirmUseExistingDeveloperTestAccountPrompt(
  account: DeveloperTestAccount
): Promise<boolean> {
  const { confirmUseExistingDeveloperTestAccount } = await promptUser<{
    confirmUseExistingDeveloperTestAccount: boolean;
  }>([
    {
      name: 'confirmUseExistingDeveloperTestAccount',
      type: 'confirm',
      message: i18n(`${i18nKey}.confirmUseExistingDeveloperTestAccount`, {
        accountName: getNonConfigDeveloperTestAccountName(account),
      }),
    },
  ]);
  return confirmUseExistingDeveloperTestAccount;
}
