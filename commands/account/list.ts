import { Argv } from 'yargs';
import {
  getConfigFilePath,
  getAllConfigAccounts,
  getConfigDefaultAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { getDefaultAccountOverrideFilePath } from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { indent } from '../../lib/ui/index.js';
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
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';
import { renderTable } from '../../ui/render.js';

const command = ['list', 'ls'];
const describe = commands.account.subcommands.list.describe;

type AccountListArgs = CommonArgs & ConfigArgs;

function sortAndMapAccounts(accounts: HubSpotConfigAccount[]): {
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

function getAccountData(mappedAccountData: {
  [key: string]: HubSpotConfigAccount[];
}): string[][] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accountData: any[][] = [];

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
      accountData.push([name, account.accountId, account.authType]);
    });
  });

  return accountData;
}

async function handler(): Promise<void> {
  const configPath = getConfigFilePath();
  const accountsList = getAllConfigAccounts();
  const mappedAccountData = sortAndMapAccounts(accountsList);

  const accountData = getAccountData(mappedAccountData);

  const tableHeader = [
    commands.account.subcommands.list.labels.name,
    commands.account.subcommands.list.labels.accountId,
    commands.account.subcommands.list.labels.authType,
  ];

  const defaultAccount = getConfigDefaultAccountIfExists();
  const accountId = defaultAccount?.accountId;
  const overrideFilePath = getDefaultAccountOverrideFilePath();

  // If a default account is present in the config, display it
  if (configPath && accountId) {
    uiLogger.log(commands.account.subcommands.list.defaultAccountTitle);
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.list.configPath(configPath)}`
    );

    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.list.currentResolvedDefaultAccount(accountId)}`
    );
    uiLogger.log('');
  }

  // If a default account override is present, display it
  if (overrideFilePath && accountId) {
    uiLogger.log(commands.account.subcommands.list.overrideFilePathTitle);
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.list.overrideFilePath(overrideFilePath)}`
    );
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.list.currentResolvedDefaultAccount(accountId)}`
    );
    uiLogger.log('');
  }

  uiLogger.log(commands.account.subcommands.list.accounts);
  renderTable(tableHeader, accountData, true);
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
  handler: makeYargsHandlerWithUsageTracking('accounts-list', handler),
  builder,
};

export default accountListCommand;
