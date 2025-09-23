import fs from 'fs';
import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  loadConfig,
  getConfigPath,
  deleteAccount,
  getConfigDefaultAccount,
  getAccountId,
  updateDefaultAccount,
  getCWDAccountOverride,
  getDefaultAccountOverrideFilePath,
} from '@hubspot/local-dev-lib/config';
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
  const { account } = args;
  let accountToRemove = account;

  if (accountToRemove && !getAccountId(accountToRemove)) {
    uiLogger.error(
      commands.account.subcommands.remove.errors.accountNotFound(
        accountToRemove,
        getConfigPath()!
      )
    );
  }

  if (!accountToRemove || !getAccountId(accountToRemove)) {
    accountToRemove = await selectAccountFromConfig(
      commands.account.subcommands.remove.prompts.selectAccountToRemove
    );
  }

  trackCommandUsage(
    'accounts-remove',
    undefined,
    getAccountId(accountToRemove)!
  );

  const currentDefaultAccount = getConfigDefaultAccount();

  const accountOverride = getCWDAccountOverride();
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (
    overrideFilePath &&
    accountOverride &&
    accountOverride === accountToRemove
  ) {
    const { deleteOverrideFile } = await promptUser({
      type: 'confirm',
      name: 'deleteOverrideFile',
      message: commands.account.subcommands.remove.prompts.deleteOverrideFile(
        overrideFilePath,
        accountToRemove
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

  await deleteAccount(accountToRemove);
  uiLogger.success(
    commands.account.subcommands.remove.success.accountRemoved(accountToRemove)
  );

  // Get updated version of the config
  loadConfig(getConfigPath()!);

  const accountToRemoveId = getAccountId(accountToRemove);
  let defaultAccountId;
  if (currentDefaultAccount) {
    defaultAccountId = getAccountId(currentDefaultAccount);
  }
  if (accountToRemoveId === defaultAccountId) {
    uiLogger.log('');
    uiLogger.log(
      commands.account.subcommands.remove.logs.replaceDefaultAccount
    );
    const newDefaultAccount = await selectAccountFromConfig();
    updateDefaultAccount(newDefaultAccount);
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
