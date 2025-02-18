import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { uiAccountDescription } from '../ui';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { isSandbox } from '../accountTypes';
import {
  getConfigDefaultAccount,
  getConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
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
  portals: CLIAccount[] | null | undefined
): PromptChoices {
  return (
    portals
      ?.filter(p => isSandbox(p))
      .map(p => ({
        name: uiAccountDescription(getAccountIdentifier(p), false),
        value: p.name || getAccountIdentifier(p),
      })) || []
  );
}

function mapNonSandboxAccountChoices(
  portals: CLIAccount[] | null | undefined
): PromptChoices {
  return (
    portals
      ?.filter(p => !isSandbox(p))
      .map(p => ({
        name: `${p.name} (${getAccountIdentifier(p)})`,
        value: p.name || getAccountIdentifier(p),
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
  const accountsList = getConfigAccounts();
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
      default: getConfigDefaultAccount(),
    },
  ]);
}
