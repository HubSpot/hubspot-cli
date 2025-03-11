import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getConfigFilePath,
  getConfigDefaultAccount,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { addConfigOptions } from '../../lib/commonOpts';
import { getTableContents, getTableHeader } from '../../lib/ui/table';
import { trackCommandUsage } from '../../lib/usageTracking';
import { isSandbox, isDeveloperTestAccount } from '../../lib/accountTypes';
import { i18n } from '../../lib/lang';
import {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} from '@hubspot/local-dev-lib/constants/config';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.list';

export const command = ['list', 'ls'];
export const describe = i18n(`${i18nKey}.describe`);

type AccountListArgs = CommonArgs & ConfigArgs;

function sortAndMapAccounts(accounts: HubSpotConfigAccount[]): {
  [key: string]: HubSpotConfigAccount[];
} {
  const mappedAccountData: { [key: string]: HubSpotConfigAccount[] } = {};
  // Standard and app developer accounts
  accounts
    .filter(
      a =>
        a.accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD ||
        a.accountType === HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER
    )

    .forEach(account => {
      if (account.accountId) {
        mappedAccountData[account.accountId] = [account];
      }
    });
  // Non-standard accounts (sandbox, developer test account)
  accounts
    .filter(a => a.accountType && (isSandbox(a) || isDeveloperTestAccount(a)))
    .forEach(a => {
      if (a.parentAccountId) {
        mappedAccountData[a.parentAccountId] = [
          ...(mappedAccountData[a.parentAccountId] || []),
          a,
        ];
      } else {
        if (a.accountId) {
          mappedAccountData[a.accountId] = [a];
        }
      }
    });

  return mappedAccountData;
}

function getAccountData(mappedAccountData: {
  [key: string]: HubSpotConfigAccount[];
}): string[][] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accountData: any[][] = [];

  Object.entries(mappedAccountData).forEach(([key, set]) => {
    const hasParentAccount = set.filter(
      a => a.accountId === parseInt(key, 10)
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
      accountData.push([name, account.accountId, account.authType]);
    });
  });

  return accountData;
}

export async function handler(
  args: ArgumentsCamelCase<AccountListArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('accounts-list', undefined, derivedAccountId);

  const configPath = getConfigFilePath();
  const accountsList = getAllConfigAccounts();
  const mappedAccountData = sortAndMapAccounts(accountsList);
  const accountData = getAccountData(mappedAccountData);
  accountData.unshift(
    getTableHeader([
      i18n(`${i18nKey}.labels.name`),
      i18n(`${i18nKey}.labels.accountId`),
      i18n(`${i18nKey}.labels.authType`),
    ])
  );

  logger.log(i18n(`${i18nKey}.configPath`, { configPath: configPath! }));
  logger.log(
    i18n(`${i18nKey}.defaultAccount`, {
      account: getConfigDefaultAccount().accountId,
    })
  );
  logger.log(i18n(`${i18nKey}.accounts`));
  logger.log(getTableContents(accountData, { border: { bodyLeft: '  ' } }));
}

export function builder(yargs: Argv): Argv<AccountListArgs> {
  addConfigOptions(yargs);

  yargs.example([['$0 accounts list']]);

  return yargs as Argv<AccountListArgs>;
}
