import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getConfigFilePath,
  setConfigAccountAsDefault,
  getConfigAccountIfExists,
  getConfigAccountByName,
  getConfigAccountById,
} from '@hubspot/local-dev-lib/config';
import {
  getDefaultAccountOverrideAccountId,
  getDefaultAccountOverrideFilePath,
} from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';

const command = 'use [account]';
const describe = commands.account.subcommands.use.describe;

type AccountUseArgs = CommonArgs & {
  account?: string;
};

async function handler(
  args: ArgumentsCamelCase<AccountUseArgs>
): Promise<void> {
  let newDefaultAccount: string | number | undefined = args.account;

  if (!newDefaultAccount) {
    newDefaultAccount = await selectAccountFromConfig();
  } else {
    const account = getConfigAccountIfExists(newDefaultAccount);
    if (!account) {
      uiLogger.error(
        commands.account.subcommands.use.errors.accountNotFound(
          newDefaultAccount,
          getConfigFilePath()
        )
      );
      newDefaultAccount = await selectAccountFromConfig();
    }
  }

  let account: HubSpotConfigAccount;

  if (!isNaN(Number(newDefaultAccount))) {
    account = getConfigAccountById(Number(newDefaultAccount));
  } else {
    account = getConfigAccountByName(String(newDefaultAccount));
  }

  trackCommandUsage('accounts-use', undefined, account?.accountId);

  const accountOverride = getDefaultAccountOverrideAccountId();
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (accountOverride && overrideFilePath) {
    uiLogger.warn(
      commands.account.subcommands.use.accountOverride(
        accountOverride.toString()
      )
    );
    uiLogger.log(commands.account.subcommands.use.accountOverrideCommands);
    uiLogger.log('');
  }

  setConfigAccountAsDefault(newDefaultAccount);

  return uiLogger.success(
    commands.account.subcommands.use.success.defaultAccountUpdated(account.name)
  );
}

function accountUseBuilder(yargs: Argv): Argv<AccountUseArgs> {
  yargs.positional('account', {
    describe: commands.account.subcommands.use.options.account.describe,
    type: 'string',
  });

  yargs.example([
    ['$0 accounts use', commands.account.subcommands.use.examples.default],
    [
      '$0 accounts use MyAccount',
      commands.account.subcommands.use.examples.nameBased,
    ],
    [
      '$0 accounts use 1234567',
      commands.account.subcommands.use.examples.idBased,
    ],
  ]);

  return yargs as Argv<AccountUseArgs>;
}

const builder = makeYargsBuilder<AccountUseArgs>(
  accountUseBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const accountUseCommand: YargsCommandModule<unknown, AccountUseArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default accountUseCommand;
