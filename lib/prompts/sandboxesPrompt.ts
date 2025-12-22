import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';
import { uiAccountDescription } from '../ui/index.js';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { isSandbox } from '../accountTypes.js';
import {
  getConfigDefaultAccountIfExists,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { PromptChoices } from '../../types/Prompts.js';
import { SandboxAccountType } from '../../types/Sandboxes.js';

type SandboxTypePromptResponse = {
  type: SandboxAccountType;
};

type DeleteSandboxPromptResponse = {
  account: string;
};

function mapSandboxAccountChoices(
  portals: HubSpotConfigAccount[] | null | undefined
): PromptChoices {
  return (
    portals
      ?.filter(p => isSandbox(p))
      .map(p => ({
        name: uiAccountDescription(p.accountId, false),
        value: p.accountId,
      })) || []
  );
}

function mapNonSandboxAccountChoices(
  portals: HubSpotConfigAccount[] | null | undefined
): PromptChoices {
  return (
    portals
      ?.filter(p => !isSandbox(p))
      .map(p => ({
        name: `${p.name} (${p.accountId})`,
        value: p.accountId,
      })) || []
  );
}

export async function sandboxTypePrompt(): Promise<SandboxTypePromptResponse> {
  return promptUser<SandboxTypePromptResponse>([
    {
      name: 'type',
      message: lib.prompts.sandboxesPrompt.type.message,
      type: 'list',
      choices: [
        {
          name: lib.prompts.sandboxesPrompt.type.developer,
          value: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
        },
        {
          name: lib.prompts.sandboxesPrompt.type.standard,
          value: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
        },
      ],
      default: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
    },
  ]);
}

export function deleteSandboxPrompt(
  promptParentAccount = false
): Promise<DeleteSandboxPromptResponse | undefined> {
  const accountsList = getAllConfigAccounts();
  const choices = promptParentAccount
    ? mapNonSandboxAccountChoices(accountsList)
    : mapSandboxAccountChoices(accountsList);
  if (!choices.length) {
    return Promise.resolve(undefined);
  }
  return promptUser<DeleteSandboxPromptResponse>([
    {
      name: 'account',
      message: promptParentAccount
        ? lib.prompts.sandboxesPrompt.selectParentAccountName
        : lib.prompts.sandboxesPrompt.selectAccountName,
      type: 'list',
      pageSize: 20,
      choices,
      default: getConfigDefaultAccountIfExists()?.accountId,
    },
  ]);
}
