import {
  getConfigDefaultAccount,
  getConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { uiAccountDescription } from '../ui';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { PromptChoices } from '../../types/prompts';

function mapAccountChoices(
  portals: CLIAccount[] | null | undefined
): PromptChoices {
  return (
    portals?.map(p => ({
      name: uiAccountDescription(getAccountIdentifier(p), false),
      value: String(p.name || getAccountIdentifier(p)),
    })) || []
  );
}

const i18nKey = 'commands.account.subcommands.use';

export async function selectAccountFromConfig(prompt = ''): Promise<string> {
  const accountsList = getConfigAccounts();
  const defaultAccount = getConfigDefaultAccount();

  const { default: selectedDefault } = await promptUser<{ default: string }>([
    {
      type: 'list',
      name: 'default',
      pageSize: 20,
      message: prompt || i18n(`${i18nKey}.promptMessage`),
      choices: mapAccountChoices(accountsList),
      default: defaultAccount ?? undefined,
    },
  ]);

  return selectedDefault;
}
