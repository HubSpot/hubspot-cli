import {
  getConfigDefaultAccountIfExists,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { promptUser } from './promptUtils.js';
import { commands } from '../../lang/en.js';
import { uiAccountDescription } from '../ui/index.js';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { PromptChoices } from '../../types/Prompts.js';

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

export async function selectAccountFromConfig(prompt = ''): Promise<number> {
  const accountsList = getAllConfigAccounts();
  const defaultAccount = getConfigDefaultAccountIfExists();

  const { default: selectedDefault } = await promptUser<{ default: number }>([
    {
      type: 'list',
      name: 'default',
      pageSize: 20,
      message: prompt || commands.account.subcommands.use.promptMessage,
      choices: mapAccountChoices(accountsList),
      default: defaultAccount?.accountId ?? undefined,
    },
  ]);

  return selectedDefault;
}
