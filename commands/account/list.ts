import { Argv } from 'yargs';
import {
  getConfigFilePath,
  getConfigDefaultAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { getDefaultAccountOverrideFilePath } from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import {
  getHsSettingsFileIfExists,
  getHsSettingsFilePath,
} from '@hubspot/local-dev-lib/config/hsSettings';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { indent } from '../../lib/ui/index.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';
import { renderAccountTable } from '../../lib/ui/accountTable.js';
import { renderLinkedAccountsTable } from '../../lib/link/renderLinkedAccountsTable.js';
import { isDirectoryLinked } from '../../lib/link/linkUtils.js';

const command = ['list', 'ls'];
const describe = commands.account.subcommands.list.describe;

type AccountListArgs = CommonArgs & ConfigArgs;

async function handler(): Promise<void> {
  const configPath = getConfigFilePath();
  const defaultAccount = getConfigDefaultAccountIfExists();
  const accountId = defaultAccount?.accountId;
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  const hsSettings = getHsSettingsFileIfExists();
  const hsSettingsPath = getHsSettingsFilePath();
  const isLinked = isDirectoryLinked(hsSettings);

  if (isLinked && hsSettingsPath) {
    uiLogger.log(commands.account.subcommands.list.linkedDefaultTitle);
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.list.directory(getCwd())}`
    );
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.list.configPath(hsSettingsPath)}`
    );
    if (hsSettings.localDefaultAccount) {
      uiLogger.log(
        `${indent(1)}${commands.account.subcommands.list.currentResolvedDefaultAccount(hsSettings.localDefaultAccount)}`
      );
    }
    uiLogger.log('');

    uiLogger.log(commands.account.subcommands.list.linkedAccounts);
    await renderLinkedAccountsTable(hsSettings);
    uiLogger.log('');
  }

  if (!isLinked && configPath && accountId) {
    uiLogger.log(commands.account.subcommands.list.defaultAccountTitle);
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.list.configPath(configPath)}`
    );
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.list.currentResolvedDefaultAccount(accountId)}`
    );
    uiLogger.log('');

    if (overrideFilePath) {
      uiLogger.log(commands.account.subcommands.list.overrideFilePathTitle);
      uiLogger.log(
        `${indent(1)}${commands.account.subcommands.list.overrideFilePath(overrideFilePath)}`
      );
      uiLogger.log(
        `${indent(1)}${commands.account.subcommands.list.currentResolvedDefaultAccount(accountId)}`
      );
      uiLogger.log('');
    }
  }

  renderAccountTable(isLinked);
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
