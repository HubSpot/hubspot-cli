import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getConfigPath,
  getConfigAccounts,
  getDefaultAccountOverrideFilePath,
  getDisplayDefaultAccount,
  getConfigDefaultAccount,
} from '@hubspot/local-dev-lib/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { indent } from '../../lib/ui/index.js';
import { getTableContents, getTableHeader } from '../../lib/ui/table.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { isSandbox, isDeveloperTestAccount } from '../../lib/accountTypes.js';
import {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} from '@hubspot/local-dev-lib/constants/config';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';

const command = ['list', 'ls'];
const describe = commands.account.subcommands.list.describe;

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

async function handler(
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
      commands.account.subcommands.list.labels.name,
      commands.account.subcommands.list.labels.accountId,
      commands.account.subcommands.list.labels.authType,
    ])
  );

  // If a default account is present in the config, display it
  if (configPath) {
    uiLogger.log(commands.account.subcommands.list.defaultAccountTitle);
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.list.configPath(configPath)}`
    );
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.list.defaultAccount(
        getDisplayDefaultAccount()!.toString()
      )}`
    );
    uiLogger.log('');
  }

  // If a default account override is present, display it
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (overrideFilePath) {
    uiLogger.log(commands.account.subcommands.list.overrideFilePathTitle);
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.list.overrideFilePath(overrideFilePath)}`
    );
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.list.overrideAccount(
        getConfigDefaultAccount()!.toString()
      )}`
    );
    uiLogger.log('');
  }
  uiLogger.log(commands.account.subcommands.list.accounts);
  uiLogger.log(getTableContents(accountData, { border: { bodyLeft: '  ' } }));
}

function accountListBuilder(yargs: Argv): Argv<AccountListArgs> {
  yargs.example([['$0 accounts list']]);

  return yargs as Argv<AccountListArgs>;
}

const builder = makeYargsBuilder<AccountListArgs>(
  accountListBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const accountListCommand: YargsCommandModule<unknown, AccountListArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default accountListCommand;
