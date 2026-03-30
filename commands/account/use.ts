import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getConfigFilePath,
  setConfigAccountAsDefault,
  getConfigAccountIfExists,
  getConfigAccountByName,
  getConfigAccountById,
  globalConfigFileExists,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import {
  getDefaultAccountOverrideAccountId,
  getDefaultAccountOverrideFilePath,
} from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  selectAccountFromConfig,
  AUTHENTICATE_NEW_ACCOUNT_VALUE,
} from '../../lib/prompts/accountsPrompt.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { authenticateNewAccount } from '../../lib/accountAuth.js';
import { PromptExitError } from '../../lib/errors/PromptExitError.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';

const command = 'use [account]';
const describe = commands.account.subcommands.use.describe;

type AccountUseArgs = CommonArgs & {
  account?: string;
};

async function handler(
  args: ArgumentsCamelCase<AccountUseArgs>
): Promise<void> {
  let newDefaultAccount: string | number | undefined = args.account;
  const usingGlobalConfig = globalConfigFileExists();

  if (!newDefaultAccount) {
    newDefaultAccount = await selectAccountFromConfig('', usingGlobalConfig);
  } else {
    const account = getConfigAccountIfExists(newDefaultAccount);
    if (!account) {
      uiLogger.error(
        commands.account.subcommands.use.errors.accountNotFound(
          newDefaultAccount,
          getConfigFilePath()
        )
      );
      newDefaultAccount = await selectAccountFromConfig('', usingGlobalConfig);
    }
  }

  if (newDefaultAccount === AUTHENTICATE_NEW_ACCOUNT_VALUE) {
    let updatedConfig;
    try {
      updatedConfig = await authenticateNewAccount({
        env: args.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD,
        setAsDefaultAccount: true,
      });
    } catch (e) {
      if (e instanceof PromptExitError) {
        process.exit(e.exitCode);
      }
      throw e;
    }

    if (!updatedConfig) {
      process.exit(EXIT_CODES.ERROR);
    }

    trackCommandUsage('accounts-use', undefined, updatedConfig.accountId);
    return;
  }

  let account: HubSpotConfigAccount;

  if (!isNaN(Number(newDefaultAccount))) {
    account = getConfigAccountById(Number(newDefaultAccount));
  } else {
    account = getConfigAccountByName(String(newDefaultAccount));
  }

  trackCommandUsage('accounts-use', undefined, account?.accountId);

  const accounts = getAllConfigAccounts();
  const accountOverride = getDefaultAccountOverrideAccountId(accounts);
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

  setConfigAccountAsDefault(String(newDefaultAccount));

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
