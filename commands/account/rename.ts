import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { renameAccount } from '@hubspot/local-dev-lib/config';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { CommonArgs, ConfigArgs, YargsCommandModule } from '../../types/Yargs';
import { logError } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'rename <account-name> <new-name>';
const describe = i18n(`commands.account.subcommands.rename.describe`);

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

  logger.log(
    i18n(`commands.account.subcommands.rename.success.renamed`, {
      name: accountName,
      newName,
    })
  );
  process.exit(EXIT_CODES.SUCCESS);
}

function accountRenameBuilder(yargs: Argv): Argv<AccountRenameArgs> {
  yargs.positional('account-name', {
    describe: i18n(
      `commands.account.subcommands.rename.positionals.accountName.describe`
    ),
    type: 'string',
  });
  yargs.positional('new-name', {
    describe: i18n(
      `commands.account.subcommands.rename.positionals.newName.describe`
    ),
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
