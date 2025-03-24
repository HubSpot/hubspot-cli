import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { uiAccountDescription } from '../ui';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { isSandbox } from '../accountTypes';
import {
  getConfigDefaultAccountIfExists,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { PromptChoices } from '../../types/Prompts';
import { SandboxAccountType } from '../../types/Sandboxes';

const i18nKey = 'lib.prompts.sandboxesPrompt';

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
        value: p.name,
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
        value: p.name,
      })) || []
  );
}

export async function sandboxTypePrompt(): Promise<SandboxTypePromptResponse> {
  return promptUser<SandboxTypePromptResponse>([
    {
      name: 'type',
      message: i18n(`${i18nKey}.type.message`),
      type: 'list',
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
      message: i18n(
        promptParentAccount
          ? `${i18nKey}.selectParentAccountName`
          : `${i18nKey}.selectAccountName`
      ),
      type: 'list',
      pageSize: 20,
      choices,
      default: getConfigDefaultAccountIfExists()?.name,
    },
  ]);
}
