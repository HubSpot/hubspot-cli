import { getSandboxUsageLimits } from '@hubspot/local-dev-lib/api/sandboxHubs';
import {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} from '@hubspot/local-dev-lib/constants/config';
import { fetchDeveloperTestAccounts } from '@hubspot/local-dev-lib/api/developerTestAccounts';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { Usage } from '@hubspot/local-dev-lib/types/Sandbox';
import {
  DeveloperTestAccount,
  FetchDeveloperTestAccountsResponse,
} from '@hubspot/local-dev-lib/types/developerTestAccounts.js';
import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';
import { uiAccountDescription } from '../ui/index.js';
import { isSandbox } from '../accountTypes.js';
import { PromptChoices } from '../../types/Prompts.js';
import { PromptExitError } from '../errors/PromptExitError.js';
import { EXIT_CODES } from '../enums/exitCodes.js';

function mapNestedAccount(accountConfig: HubSpotConfigAccount): {
  name: string;
  value: {
    targetAccountId: number | null;
    createNestedAccount: boolean;
    parentAccountId: number | null;
  };
} {
  const parentAccountId = accountConfig.parentAccountId ?? null;
  return {
    name: uiAccountDescription(accountConfig.accountId, false),
    value: {
      targetAccountId: accountConfig.accountId,
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
  accounts: HubSpotConfigAccount[],
  defaultAccountConfig: HubSpotConfigAccount
): Promise<ProjectDevTargetAccountPromptResponse> {
  const defaultAccountId = defaultAccountConfig.accountId;
  if (!defaultAccountId) {
    uiLogger.error(lib.prompts.projectDevTargetAccountPrompt.noAccountId);
    throw new PromptExitError(
      lib.prompts.projectDevTargetAccountPrompt.noAccountId,
      EXIT_CODES.ERROR
    );
  }
  let choices = [];
  let sandboxUsage: Usage = {
    STANDARD: { used: 0, available: 0, limit: 0 },
    DEVELOPER: { used: 0, available: 0, limit: 0 },
  };
  try {
    const { data } = await getSandboxUsageLimits(defaultAccountId);
    sandboxUsage = data.usage;
  } catch (err) {
    uiLogger.debug('Unable to fetch sandbox usage limits: ', err);
  }

  const sandboxAccounts = accounts
    .reverse()
    .filter(
      config => isSandbox(config) && config.parentAccountId === defaultAccountId
    );
  let disabledMessage: string | boolean = false;

  if (sandboxUsage['DEVELOPER'] && sandboxUsage['DEVELOPER'].available === 0) {
    if (sandboxAccounts.length < sandboxUsage['DEVELOPER'].limit) {
      disabledMessage =
        lib.prompts.projectDevTargetAccountPrompt.sandboxLimitWithSuggestion(
          sandboxUsage['DEVELOPER'].limit
        );
    } else {
      disabledMessage = lib.prompts.projectDevTargetAccountPrompt.sandboxLimit(
        sandboxUsage['DEVELOPER'].limit
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
      name: lib.prompts.projectDevTargetAccountPrompt.createNewSandboxOption,
      value: {
        targetAccountId: null,
        createNestedAccount: true,
      },
      disabled: disabledMessage,
    },
    {
      name: lib.prompts.projectDevTargetAccountPrompt
        .chooseDefaultAccountOption,
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
  defaultAccountConfig: HubSpotConfigAccount
): Promise<ProjectDevTargetAccountPromptResponse> {
  const defaultAccountId = defaultAccountConfig.accountId;
  if (!defaultAccountId) {
    uiLogger.error(lib.prompts.projectDevTargetAccountPrompt.noAccountId);
    throw new PromptExitError(
      lib.prompts.projectDevTargetAccountPrompt.noAccountId,
      EXIT_CODES.ERROR
    );
  }
  let devTestAccountsResponse: FetchDeveloperTestAccountsResponse | undefined;
  try {
    const { data } = await fetchDeveloperTestAccounts(defaultAccountId);
    devTestAccountsResponse = data;
  } catch (err) {
    uiLogger.debug(
      'Unable to fetch developer test account usage limits: ',
      err
    );
  }

  let disabledMessage: string | boolean = false;
  if (
    devTestAccountsResponse &&
    devTestAccountsResponse.results.length >=
      devTestAccountsResponse.maxTestPortals
  ) {
    disabledMessage =
      lib.prompts.projectDevTargetAccountPrompt.developerTestAccountLimit(
        devTestAccountsResponse.maxTestPortals
      );
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
      name: lib.prompts.projectDevTargetAccountPrompt
        .createNewDeveloperTestAccountOption,
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
      message: lib.prompts.projectDevTargetAccountPrompt.promptMessage(
        accountType,
        uiAccountDescription(accountId)
      ),
      choices,
      loop: false,
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
      message: lib.prompts.projectDevTargetAccountPrompt.confirmDefaultAccount(
        accountName,
        accountType
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
      message:
        lib.prompts.projectDevTargetAccountPrompt.confirmUseExistingDeveloperTestAccount(
          getNonConfigDeveloperTestAccountName(account)
        ),
    },
  ]);
  return confirmUseExistingDeveloperTestAccount;
}

export async function confirmLinkExistingDeveloperTestAccountPrompt(
  accountName: string
): Promise<boolean> {
  const { confirmLinkExistingDeveloperTestAccount } = await promptUser<{
    confirmLinkExistingDeveloperTestAccount: boolean;
  }>([
    {
      name: 'confirmLinkExistingDeveloperTestAccount',
      type: 'confirm',
      message:
        lib.prompts.projectDevTargetAccountPrompt.confirmLinkExistingDeveloperTestAccount(
          accountName
        ),
    },
  ]);
  return confirmLinkExistingDeveloperTestAccount;
}
