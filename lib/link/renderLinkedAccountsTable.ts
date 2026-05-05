import { HsSettingsFile } from '@hubspot/local-dev-lib/types/HsSettings';
import { commands } from '../../lang/en.js';
import { renderTable } from '../../ui/render.js';
import { buildAccountRow, sortDefaultFirst } from './accountTableUtils.js';

export async function renderLinkedAccountsTable(
  settings: HsSettingsFile
): Promise<void> {
  const labels = commands.account.subcommands.list.labels;
  const tableHeader = [labels.name, labels.accountId];

  const sortedAccounts = sortDefaultFirst(
    settings.accounts,
    settings.localDefaultAccount
  );

  const tableData = sortedAccounts.map(accountId => {
    const isDefault = accountId === settings.localDefaultAccount;
    const row = buildAccountRow(accountId, isDefault);
    return [row.name, row.accountId];
  });

  await renderTable(tableHeader, tableData, true);
}
