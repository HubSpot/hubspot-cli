import fs from 'fs';
import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getConfigFilePath,
  removeAccountFromConfig,
  getConfigDefaultAccountIfExists,
  getConfigAccountIfExists,
  getConfigAccountById,
  setConfigAccountAsDefault,
} from '@hubspot/local-dev-lib/config';
import {
  getDefaultAccountOverrideAccountId,
  getDefaultAccountOverrideFilePath,
} from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';

const command = 'remove [account]';
const describe = commands.account.subcommands.remove.describe;

type AccountRemoveArgs = CommonArgs &
  ConfigArgs & {
    account?: string;
  };

async function handler(
  args: ArgumentsCamelCase<AccountRemoveArgs>
): Promise<void> {
  const { account: accountFlag } = args;

  let accountToRemoveConfig = accountFlag
    ? getConfigAccountIfExists(accountFlag)
    : undefined;

  let accountToRemoveId = accountToRemoveConfig?.accountId;

  if (accountFlag && !accountToRemoveConfig) {
    uiLogger.error(
      commands.account.subcommands.remove.errors.accountNotFound(
        accountFlag,
        getConfigFilePath()
      )
    );
  }

  if (!accountToRemoveId) {
    accountToRemoveId = await selectAccountFromConfig(
      commands.account.subcommands.remove.prompts.selectAccountToRemove
    );
  }

  accountToRemoveConfig = getConfigAccountById(accountToRemoveId);
  trackCommandUsage('accounts-remove', undefined, accountToRemoveId);

  const currentDefaultAccount = getConfigDefaultAccountIfExists();

  const accountOverride = getDefaultAccountOverrideAccountId();
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (
    overrideFilePath &&
    accountOverride &&
    accountOverride === accountToRemoveConfig?.accountId
  ) {
    const { deleteOverrideFile } = await promptUser({
      type: 'confirm',
      name: 'deleteOverrideFile',
      message: commands.account.subcommands.remove.prompts.deleteOverrideFile(
        overrideFilePath,
        accountToRemoveConfig.name
      ),
    });
    try {
      if (deleteOverrideFile) {
        fs.unlinkSync(overrideFilePath);
      }
    } catch (error) {
      logError(error);
    }
  }

  if (accountToRemoveConfig) {
    removeAccountFromConfig(accountToRemoveConfig.accountId);
  }
  uiLogger.success(
    commands.account.subcommands.remove.success.accountRemoved(
      accountToRemoveConfig.name
    )
  );

  if (
    currentDefaultAccount &&
    accountToRemoveConfig?.accountId === currentDefaultAccount.accountId
  ) {
    uiLogger.log('');
    uiLogger.log(
      commands.account.subcommands.remove.logs.replaceDefaultAccount
    );
    const newDefaultAccount = await selectAccountFromConfig();
    setConfigAccountAsDefault(newDefaultAccount);
  }
}

function accountRemoveBuilder(yargs: Argv): Argv<AccountRemoveArgs> {
  yargs.positional('account', {
    describe: commands.account.subcommands.remove.options.account.describe,
    type: 'string',
  });

  yargs.example([
    [
      '$0 accounts remove',
      commands.account.subcommands.remove.examples.default,
    ],
    [
      '$0 accounts remove MyAccount',
      commands.account.subcommands.remove.examples.byName,
    ],
  ]);

  return yargs as Argv<AccountRemoveArgs>;
}

const builder = makeYargsBuilder<AccountRemoveArgs>(
  accountRemoveBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const accountRemoveCommand: YargsCommandModule<unknown, AccountRemoveArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default accountRemoveCommand;
