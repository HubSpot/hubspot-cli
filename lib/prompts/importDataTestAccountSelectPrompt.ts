import { promptUser } from './promptUtils.js';
import { getAllConfigAccounts } from '@hubspot/local-dev-lib/config';
import { uiAccountDescription } from '../ui/index.js';
import { lib } from '../../lang/en.js';

export async function importDataTestAccountSelectPrompt(
  parentAccountId: number
): Promise<{ selectedAccountId: number }> {
  const accounts = getAllConfigAccounts();

  if (!accounts) {
    throw new Error(
      lib.prompts.importDataTestAccountSelectPrompt.errors.noAccountsFound
    );
  }

  const childAccounts: { name: string; value: number }[] = accounts
    .filter(account => account.parentAccountId === parentAccountId)
    .map(account => {
      return {
        name: uiAccountDescription(account.accountId),
        value: account.accountId,
      };
    })
    .filter(
      account => account.value !== undefined && account.name !== undefined
    ) as { name: string; value: number }[];

  if (childAccounts.length === 0) {
    throw new Error(
      lib.prompts.importDataTestAccountSelectPrompt.errors.noChildTestAccountsFound(
        parentAccountId
      )
    );
  }

  return promptUser<{
    selectedAccountId: number;
  }>({
    type: 'list',
    name: 'selectedAccountId',
    message: '[--account] Select a developer test account:',
    choices: childAccounts,
  });
}
