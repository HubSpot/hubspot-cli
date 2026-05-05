import {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} from '@hubspot/local-dev-lib/constants/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { isSandbox, isDeveloperTestAccount } from '../accountTypes.js';
import { getAllConfigAccounts } from '@hubspot/local-dev-lib/config';
import { commands } from '../../lang/en.js';
import { renderTable } from '../../ui/render.js';
import { uiLogger } from './logger.js';

export function sortAndMapAccounts(accounts: HubSpotConfigAccount[]): {
  [key: string]: HubSpotConfigAccount[];
} {
  const mappedAccountData: { [key: string]: HubSpotConfigAccount[] } = {};
  // Standard and app developer accounts
  accounts
    .filter(
      p =>
        p.accountType &&
        (p.accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD ||
          p.accountType === HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER)
    )
    .forEach(account => {
      mappedAccountData[account.accountId] = [account];
    });
  // Non-standard accounts (sandbox, developer test account)
  accounts
    .filter(p => p.accountType && (isSandbox(p) || isDeveloperTestAccount(p)))
    .forEach(p => {
      if (p.parentAccountId) {
        mappedAccountData[p.parentAccountId] = [
          ...(mappedAccountData[p.parentAccountId] || []),
          p,
        ];
      } else {
        mappedAccountData[p.accountId] = [p];
      }
    });

  return mappedAccountData;
}

export function getAccountData(mappedAccountData: {
  [key: string]: HubSpotConfigAccount[];
}): string[][] {
  const accountData: string[][] = [];

  Object.entries(mappedAccountData).forEach(([key, set]) => {
    const hasParentAccount = set.filter(
      p => p.accountId === parseInt(key, 10)
    )[0];
    set.forEach(account => {
      let name = `${account.name} [${
        HUBSPOT_ACCOUNT_TYPE_STRINGS[account.accountType!]
      }]`;
      if (isSandbox(account)) {
        if (hasParentAccount && set.length > 1) {
          name = `↳ ${name}`;
        }
      } else if (isDeveloperTestAccount(account)) {
        if (hasParentAccount && set.length > 1) {
          name = `↳ ${name}`;
        }
      }
      accountData.push([name, String(account.accountId), account.authType]);
    });
  });

  return accountData;
}

export function renderAccountTable(showAllLabel = false): void {
  const accountsList = getAllConfigAccounts();
  const mappedAccountData = sortAndMapAccounts(accountsList);
  const accountData = getAccountData(mappedAccountData);

  const tableHeader = [
    commands.account.subcommands.list.labels.name,
    commands.account.subcommands.list.labels.accountId,
    commands.account.subcommands.list.labels.authType,
  ];

  uiLogger.log(
    showAllLabel
      ? commands.account.subcommands.list.allAccounts
      : commands.account.subcommands.list.accounts
  );
  renderTable(tableHeader, accountData, true);
}
