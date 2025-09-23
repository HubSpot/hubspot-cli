import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getConfigPath,
  updateDefaultAccount,
  getAccountId,
  getCWDAccountOverride,
  getDefaultAccountOverrideFilePath,
} from '@hubspot/local-dev-lib/config';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'use [account]';
const describe = commands.account.subcommands.use.describe;

type AccountUseArgs = CommonArgs & {
  account?: string;
};

async function handler(
  args: ArgumentsCamelCase<AccountUseArgs>
): Promise<void> {
  let newDefaultAccount = args.account;

  if (!newDefaultAccount) {
    newDefaultAccount = await selectAccountFromConfig();
  } else if (!getAccountId(newDefaultAccount)) {
    uiLogger.error(
      commands.account.subcommands.use.errors.accountNotFound(
        newDefaultAccount,
        getConfigPath()!
      )
    );
    newDefaultAccount = await selectAccountFromConfig();
  }

  trackCommandUsage(
    'accounts-use',
    undefined,
    getAccountId(newDefaultAccount)!
  );

  const accountOverride = getCWDAccountOverride();
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

  updateDefaultAccount(newDefaultAccount);

  return uiLogger.success(
    commands.account.subcommands.use.success.defaultAccountUpdated(
      newDefaultAccount
    )
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
