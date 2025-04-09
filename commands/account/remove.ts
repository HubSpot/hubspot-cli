import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  loadConfig,
  getConfigPath,
  deleteAccount,
  getConfigDefaultAccount,
  getAccountId,
  updateDefaultAccount,
} from '@hubspot/local-dev-lib/config';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { addConfigOptions } from '../../lib/commonOpts';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';

export const command = 'remove [account]';
export const describe = i18n(`commands.account.subcommands.remove.describe`);

type AccountRemoveArgs = CommonArgs &
  ConfigArgs & {
    account?: string;
  };

export async function handler(
  args: ArgumentsCamelCase<AccountRemoveArgs>
): Promise<void> {
  const { account } = args;
  let accountToRemove = account;

  if (accountToRemove && !getAccountId(accountToRemove)) {
    logger.error(
      i18n(`commands.account.subcommands.remove.errors.accountNotFound`, {
        specifiedAccount: accountToRemove,
        configPath: getConfigPath()!,
      })
    );
  }

  if (!accountToRemove || !getAccountId(accountToRemove)) {
    accountToRemove = await selectAccountFromConfig(
      i18n(`commands.account.subcommands.remove.prompts.selectAccountToRemove`)
    );
  }

  trackCommandUsage(
    'accounts-remove',
    undefined,
    getAccountId(accountToRemove)!
  );

  const currentDefaultAccount = getConfigDefaultAccount();

  await deleteAccount(accountToRemove);
  logger.success(
    i18n(`commands.account.subcommands.remove.success.accountRemoved`, {
      accountName: accountToRemove,
    })
  );

  // Get updated version of the config
  loadConfig(getConfigPath()!);

  if (accountToRemove === currentDefaultAccount) {
    logger.log();
    logger.log(
      i18n(`commands.account.subcommands.remove.logs.replaceDefaultAccount`)
    );
    const newDefaultAccount = await selectAccountFromConfig();
    updateDefaultAccount(newDefaultAccount);
  }
}

export function builder(yargs: Argv): Argv<AccountRemoveArgs> {
  addConfigOptions(yargs);

  yargs.positional('account', {
    describe: i18n(
      `commands.account.subcommands.remove.options.account.describe`
    ),
    type: 'string',
  });

  yargs.example([
    [
      '$0 accounts remove',
      i18n(`commands.account.subcommands.remove.examples.default`),
    ],
    [
      '$0 accounts remove MyAccount',
      i18n(`commands.account.subcommands.remove.examples.byName`),
    ],
  ]);

  return yargs as Argv<AccountRemoveArgs>;
}
