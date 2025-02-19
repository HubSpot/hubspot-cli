import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { renameAccount } from '@hubspot/local-dev-lib/config';
import { addConfigOptions, addAccountOptions } from '../../lib/commonOpts';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';
import { logError } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';

const i18nKey = 'commands.account.subcommands.rename';

export const command = 'rename <account-name> <new-name>';
export const describe = i18n(`${i18nKey}.describe`);

type AccountRenameArgs = CommonArgs &
  ConfigArgs & {
    accountName: string;
    newName: string;
  };

export async function handler(
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
    i18n(`${i18nKey}.success.renamed`, {
      name: accountName,
      newName,
    })
  );
  process.exit(EXIT_CODES.SUCCESS);
}

export function builder(yargs: Argv): Argv<AccountRenameArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);

  yargs.positional('account-name', {
    describe: i18n(`${i18nKey}.positionals.accountName.describe`),
    type: 'string',
  });
  yargs.positional('new-name', {
    describe: i18n(`${i18nKey}.positionals.newName.describe`),
    type: 'string',
  });

  yargs.example([
    ['$0 accounts rename myExistingAccountName myNewAccountName'],
  ]);

  return yargs as Argv<AccountRenameArgs>;
}
