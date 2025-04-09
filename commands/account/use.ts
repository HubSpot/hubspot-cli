import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getConfigPath,
  updateDefaultAccount,
  getAccountId,
} from '@hubspot/local-dev-lib/config';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { CommonArgs } from '../../types/Yargs';

export const command = 'use [account]';
export const describe = i18n('commands.account.subcommands.use.describe');

interface AccountUseArgs extends CommonArgs {
  account?: string;
}

export async function handler(
  args: ArgumentsCamelCase<AccountUseArgs>
): Promise<void> {
  let newDefaultAccount = args.account;

  if (!newDefaultAccount) {
    newDefaultAccount = await selectAccountFromConfig();
  } else if (!getAccountId(newDefaultAccount)) {
    logger.error(
      i18n('commands.account.subcommands.use.errors.accountNotFound', {
        specifiedAccount: newDefaultAccount,
        configPath: getConfigPath()!,
      })
    );
    newDefaultAccount = await selectAccountFromConfig();
  }

  trackCommandUsage(
    'accounts-use',
    undefined,
    getAccountId(newDefaultAccount)!
  );

  updateDefaultAccount(newDefaultAccount);

  return logger.success(
    i18n('commands.account.subcommands.use.success.defaultAccountUpdated', {
      accountName: newDefaultAccount,
    })
  );
}

export function builder(yargs: Argv): Argv<AccountUseArgs> {
  yargs.positional('account', {
    describe: i18n('commands.account.subcommands.use.options.account.describe'),
    type: 'string',
  });

  yargs.example([
    [
      '$0 accounts use',
      i18n('commands.account.subcommands.use.examples.default'),
    ],
    [
      '$0 accounts use MyAccount',
      i18n('commands.account.subcommands.use.examples.nameBased'),
    ],
    [
      '$0 accounts use 1234567',
      i18n('commands.account.subcommands.use.examples.idBased'),
    ],
  ]);

  return yargs as Argv<AccountUseArgs>;
}
