import {
  getConfigDefaultAccountIfExists,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { promptUser } from './promptUtils.js';
import { commands } from '../../lang/en.js';
import { uiAccountDescription } from '../ui/index.js';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { PromptChoices } from '../../types/Prompts.js';

export const AUTHENTICATE_NEW_ACCOUNT_VALUE = -1;

function mapAccountChoices(
  portals: HubSpotConfigAccount[] | null | undefined
): PromptChoices {
  return (
    portals?.map(p => ({
      name: uiAccountDescription(p.accountId, false),
      value: p.accountId,
    })) || []
  );
}

export async function selectAccountFromConfig(
  prompt = '',
  includeAuthOption = false
): Promise<number> {
  const accountsList = getAllConfigAccounts();
  const defaultAccount = getConfigDefaultAccountIfExists();

  const choices = mapAccountChoices(accountsList);

  if (includeAuthOption) {
    choices.push({
      name: commands.account.subcommands.use.authenticateNewAccount,
      value: AUTHENTICATE_NEW_ACCOUNT_VALUE,
    });
  }

  const { default: selectedDefault } = await promptUser<{ default: number }>([
    {
      type: 'list',
      name: 'default',
      pageSize: 20,
      message: prompt || commands.account.subcommands.use.promptMessage,
      choices,
      default: defaultAccount?.accountId ?? undefined,
    },
  ]);

  return selectedDefault;
}
