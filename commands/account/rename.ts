import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { renameAccount } from '@hubspot/local-dev-lib/config';
import { addConfigOptions, addAccountOptions } from '../../lib/commonOpts';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.rename';

export const command = 'rename <accountName> <newName>';
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

  await renameAccount(accountName, newName);

  return logger.log(
    i18n(`${i18nKey}.success.renamed`, {
      name: accountName,
      newName,
    })
  );
}

export function builder(yargs: Argv): Argv<AccountRenameArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);

  yargs.positional('accountName', {
    describe: i18n(`${i18nKey}.positionals.accountName.describe`),
    type: 'string',
  });
  yargs.positional('newName', {
    describe: i18n(`${i18nKey}.positionals.newName.describe`),
    type: 'string',
  });

  yargs.example([['$0 accounts rename myExistingPortalName myNewPortalName']]);

  return yargs as Argv<AccountRenameArgs>;
}
