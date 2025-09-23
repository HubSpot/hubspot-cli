import { Argv, ArgumentsCamelCase } from 'yargs';
import { renameAccount } from '@hubspot/local-dev-lib/config';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'rename <account-name> <new-name>';
const describe = commands.account.subcommands.rename.describe;

type AccountRenameArgs = CommonArgs &
  ConfigArgs & {
    accountName: string;
    newName: string;
  };

async function handler(
  args: ArgumentsCamelCase<AccountRenameArgs>
): Promise<void> {
  const { accountName, newName, derivedAccountId } = args;

  trackCommandUsage('accounts-rename', undefined, derivedAccountId);

  try {
    await renameAccount(accountName, newName);
  } catch (error) {
    logError(error);
    process.exit(EXIT_CODES.ERROR);
  }

  uiLogger.log(
    commands.account.subcommands.rename.success.renamed(accountName, newName)
  );
  process.exit(EXIT_CODES.SUCCESS);
}

function accountRenameBuilder(yargs: Argv): Argv<AccountRenameArgs> {
  yargs.positional('account-name', {
    describe:
      commands.account.subcommands.rename.positionals.accountName.describe,
    type: 'string',
  });
  yargs.positional('new-name', {
    describe: commands.account.subcommands.rename.positionals.newName.describe,
    type: 'string',
  });

  yargs.example([
    ['$0 accounts rename myExistingAccountName myNewAccountName'],
  ]);

  return yargs as Argv<AccountRenameArgs>;
}

const builder = makeYargsBuilder<AccountRenameArgs>(
  accountRenameBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
  }
);

const accountRenameCommand: YargsCommandModule<unknown, AccountRenameArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default accountRenameCommand;
