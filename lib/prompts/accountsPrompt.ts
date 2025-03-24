import {
  getConfigDefaultAccountIfExists,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { uiAccountDescription } from '../ui';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { PromptChoices } from '../../types/Prompts';

function mapAccountChoices(
  portals: HubSpotConfigAccount[] | null | undefined
): PromptChoices {
  return (
    portals?.map(p => ({
      name: uiAccountDescription(p.accountId, false),
      value: p.name,
    })) || []
  );
}

const i18nKey = 'commands.account.subcommands.use';

export async function selectAccountFromConfig(prompt = ''): Promise<string> {
  const accountsList = getAllConfigAccounts();
  const defaultAccount = getConfigDefaultAccountIfExists();

  const { default: selectedDefault } = await promptUser<{ default: string }>([
    {
      type: 'list',
      name: 'default',
      pageSize: 20,
      message: prompt || i18n(`${i18nKey}.promptMessage`),
      choices: mapAccountChoices(accountsList),
      default: defaultAccount?.name,
    },
  ]);

  return selectedDefault;
}
