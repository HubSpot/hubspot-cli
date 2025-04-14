import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getConfigPath,
  getConfigAccounts,
  getDefaultAccountOverrideFilePath,
  getDisplayDefaultAccount,
  getConfigDefaultAccount,
} from '@hubspot/local-dev-lib/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { addConfigOptions } from '../../lib/commonOpts';
import { indent } from '../../lib/ui/index';
import { getTableContents, getTableHeader } from '../../lib/ui/table';
import { trackCommandUsage } from '../../lib/usageTracking';
import { isSandbox, isDeveloperTestAccount } from '../../lib/accountTypes';
import { i18n } from '../../lib/lang';
import {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} from '@hubspot/local-dev-lib/constants/config';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';

export const command = ['list', 'ls'];
export const describe = i18n('commands.account.subcommands.list.describe');

type AccountListArgs = CommonArgs & ConfigArgs;

function sortAndMapAccounts(accounts: CLIAccount[]): {
  [key: string]: CLIAccount[];
} {
  const mappedAccountData: { [key: string]: CLIAccount[] } = {};
  // Standard and app developer accounts
  accounts
    .filter(
      p =>
        p.accountType &&
        (p.accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD ||
          p.accountType === HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER)
    )
    .forEach(account => {
      const accountId = getAccountIdentifier(account);
      if (accountId) {
        mappedAccountData[accountId] = [account];
      }
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
        const accountId = getAccountIdentifier(p);
        if (accountId) {
          mappedAccountData[accountId] = [p];
        }
      }
    });

  return mappedAccountData;
}

function getAccountData(mappedAccountData: {
  [key: string]: CLIAccount[];
}): string[][] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accountData: any[][] = [];

  Object.entries(mappedAccountData).forEach(([key, set]) => {
    const hasParentAccount = set.filter(
      p => getAccountIdentifier(p) === parseInt(key, 10)
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
      accountData.push([name, getAccountIdentifier(account), account.authType]);
    });
  });

  return accountData;
}

export async function handler(
  args: ArgumentsCamelCase<AccountListArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('accounts-list', undefined, derivedAccountId);

  const configPath = getConfigPath();
  const accountsList = getConfigAccounts() || [];
  const mappedAccountData = sortAndMapAccounts(accountsList);

  const accountData = getAccountData(mappedAccountData);

  accountData.unshift(
    getTableHeader([
      i18n('commands.account.subcommands.list.labels.name'),
      i18n('commands.account.subcommands.list.labels.accountId'),
      i18n('commands.account.subcommands.list.labels.authType'),
    ])
  );

  // If a default account is present in the config, display it
  if (configPath) {
    logger.log(i18n(`commands.account.subcommands.list.defaultAccountTitle`));
    logger.log(
      `${indent(1)}${i18n(`commands.account.subcommands.list.configPath`, {
        configPath,
      })}`
    );
    logger.log(
      `${indent(1)}${i18n(`commands.account.subcommands.list.defaultAccount`, {
        account: getDisplayDefaultAccount()!,
      })}`
    );
    logger.log('');
  }

  // If a default account override is present, display it
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (overrideFilePath) {
    logger.log(i18n(`commands.account.subcommands.list.overrideFilePathTitle`));
    logger.log(
      `${indent(1)}${i18n(`commands.account.subcommands.list.overrideFilePath`, { overrideFilePath })}`
    );
    logger.log(
      `${indent(1)}${i18n(`commands.account.subcommands.list.overrideAccount`, {
        account: getConfigDefaultAccount()!,
      })}`
    );
    logger.log('');
  }
  logger.log(i18n(`commands.account.subcommands.list.accounts`));
  logger.log(getTableContents(accountData, { border: { bodyLeft: '  ' } }));
}

export function builder(yargs: Argv): Argv<AccountListArgs> {
  addConfigOptions(yargs);

  yargs.example([['$0 accounts list']]);

  return yargs as Argv<AccountListArgs>;
}
