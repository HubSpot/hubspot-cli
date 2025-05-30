import { getAccountId } from '@hubspot/local-dev-lib/config';
import { getSandboxUsageLimits } from '@hubspot/local-dev-lib/api/sandboxHubs';
import {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} from '@hubspot/local-dev-lib/constants/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchDeveloperTestAccounts } from '@hubspot/local-dev-lib/api/developerTestAccounts';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { Usage } from '@hubspot/local-dev-lib/types/Sandbox';
import {
  DeveloperTestAccount,
  FetchDeveloperTestAccountsResponse,
} from '@hubspot/local-dev-lib/types/developerTestAccounts';
import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { uiAccountDescription, uiCommandReference } from '../ui';
import { isSandbox } from '../accountTypes';
import { PromptChoices } from '../../types/Prompts';
import { EXIT_CODES } from '../enums/exitCodes';

function mapNestedAccount(accountConfig: CLIAccount): {
  name: string;
  value: {
    targetAccountId: number | null;
    createNestedAccount: boolean;
    parentAccountId: number | null;
  };
} {
  const parentAccountId = accountConfig.parentAccountId ?? null;
  return {
    name: uiAccountDescription(getAccountIdentifier(accountConfig), false),
    value: {
      targetAccountId: getAccountId(accountConfig.name),
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

export type ProjectDevTargetAccountPromptResponse = {
  targetAccountId: number | null;
  createNestedAccount: boolean;
  parentAccountId?: number | null;
  notInConfigAccount?: DeveloperTestAccount | null;
};

export async function selectSandboxTargetAccountPrompt(
  accounts: CLIAccount[],
  defaultAccountConfig: CLIAccount
): Promise<ProjectDevTargetAccountPromptResponse> {
  const defaultAccountId = getAccountId(defaultAccountConfig.name);
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
      logger.error(
        i18n(`lib.prompts.projectDevTargetAccountPrompt.noAccountId`)
      );
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
      disabledMessage = i18n(
        `lib.prompts.projectDevTargetAccountPrompt.sandboxLimitWithSuggestion`,
        {
          authCommand: uiCommandReference('hs auth'),
          limit: sandboxUsage['DEVELOPER'].limit,
        }
      );
    } else {
      disabledMessage = i18n(
        `lib.prompts.projectDevTargetAccountPrompt.sandboxLimit`,
        {
          limit: sandboxUsage['DEVELOPER'].limit,
        }
      );
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
      name: i18n(
        `lib.prompts.projectDevTargetAccountPrompt.createNewSandboxOption`
      ),
      value: {
        targetAccountId: null,
        createNestedAccount: true,
      },
      disabled: disabledMessage,
    },
    {
      name: i18n(
        `lib.prompts.projectDevTargetAccountPrompt.chooseDefaultAccountOption`
      ),
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
  accounts: CLIAccount[],
  defaultAccountConfig: CLIAccount
): Promise<ProjectDevTargetAccountPromptResponse> {
  const defaultAccountId = getAccountId(defaultAccountConfig.name);
  let devTestAccountsResponse: FetchDeveloperTestAccountsResponse | undefined;
  try {
    if (defaultAccountId) {
      const { data } = await fetchDeveloperTestAccounts(defaultAccountId);
      devTestAccountsResponse = data;
    } else {
      logger.error(
        i18n(`lib.prompts.projectDevTargetAccountPrompt.noAccountId`)
      );
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
    disabledMessage = i18n(
      `lib.prompts.projectDevTargetAccountPrompt.developerTestAccountLimit`,
      {
        authCommand: uiCommandReference('hs auth'),
        limit: devTestAccountsResponse.maxTestPortals,
      }
    );
  }

  const devTestAccounts: PromptChoices = [];
  if (devTestAccountsResponse && devTestAccountsResponse.results) {
    const accountIds = accounts.map(account => getAccountIdentifier(account));

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
      name: i18n(
        `lib.prompts.projectDevTargetAccountPrompt.createNewDeveloperTestAccountOption`
      ),
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
      message: i18n(`lib.prompts.projectDevTargetAccountPrompt.promptMessage`, {
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
      message: i18n(
        `lib.prompts.projectDevTargetAccountPrompt.confirmDefaultAccount`,
        {
          accountName,
          accountType,
        }
      ),
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
      message: i18n(
        `lib.prompts.projectDevTargetAccountPrompt.confirmUseExistingDeveloperTestAccount`,
        {
          accountName: getNonConfigDeveloperTestAccountName(account),
        }
      ),
    },
  ]);
  return confirmUseExistingDeveloperTestAccount;
}
