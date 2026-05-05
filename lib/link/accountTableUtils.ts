import { HUBSPOT_ACCOUNT_TYPE_STRINGS } from '@hubspot/local-dev-lib/constants/config';
import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';
import chalk from 'chalk';
import { commands } from '../../lang/en.js';
import { indent } from '../ui/index.js';
import { INK_COLORS } from '../../ui/styles.js';

export interface AccountRow {
  name: string;
  accountId: string;
}

export function buildAccountRow(
  accountId: number,
  isDefault: boolean
): AccountRow {
  const account = getConfigAccountIfExists(accountId);
  let name = String(accountId);

  if (account && account.accountType) {
    const typeStr = HUBSPOT_ACCOUNT_TYPE_STRINGS[account.accountType];
    name = `${account.name} [${typeStr}]`;
  }
  if (isDefault) {
    name = `${name} (default)`;
  }

  return { name, accountId: String(accountId) };
}

export function buildAccountHeader(nameColumnWidth: number): string {
  const labels = commands.account.subcommands.list.labels;
  const paddedName = chalk.bold(
    chalk.hex(INK_COLORS.INFO_BLUE)(labels.name.padEnd(nameColumnWidth))
  );
  const accountId = chalk.bold(
    chalk.hex(INK_COLORS.INFO_BLUE)(labels.accountId)
  );
  return `${indent(1)}${paddedName}  ${accountId}`;
}

export function getNameColumnWidth(rows: AccountRow[]): number {
  const labels = commands.account.subcommands.list.labels;
  return Math.max(labels.name.length, ...rows.map(r => r.name.length));
}

export function sortDefaultFirst<T extends number | { accountId: number }>(
  items: T[],
  defaultAccount: number | undefined
): T[] {
  return [...items].sort((a, b) => {
    const aId = typeof a === 'number' ? a : a.accountId;
    const bId = typeof b === 'number' ? b : b.accountId;
    if (aId === defaultAccount) return -1;
    if (bId === defaultAccount) return 1;
    return 0;
  });
}
