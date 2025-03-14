import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getConfigFilePath,
  setConfigAccountAsDefault,
  getConfigAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { CommonArgs } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.use';

export const command = 'use [account]';
export const describe = i18n(`${i18nKey}.describe`);

interface AccountUseArgs extends CommonArgs {
  account?: string;
}

export async function handler(
  args: ArgumentsCamelCase<AccountUseArgs>
): Promise<void> {
  let newDefaultAccountIdentifier = args.account;

  if (!newDefaultAccountIdentifier) {
    newDefaultAccountIdentifier = await selectAccountFromConfig();
  } else if (!getConfigAccountIfExists(newDefaultAccountIdentifier)) {
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        specifiedAccount: newDefaultAccountIdentifier,
        configPath: getConfigFilePath(),
      })
    );
    newDefaultAccountIdentifier = await selectAccountFromConfig();
  }

  const newDefaultAccount = getConfigAccountIfExists(
    newDefaultAccountIdentifier
  )!;

  trackCommandUsage('accounts-use', undefined, newDefaultAccount.accountId);

  setConfigAccountAsDefault(newDefaultAccountIdentifier);

  return logger.success(
    i18n(`${i18nKey}.success.defaultAccountUpdated`, {
      accountName: newDefaultAccount.name,
    })
  );
}

export function builder(yargs: Argv): Argv<AccountUseArgs> {
  yargs.positional('account', {
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });

  yargs.example([
    ['$0 accounts use', i18n(`${i18nKey}.examples.default`)],
    ['$0 accounts use MyAccount', i18n(`${i18nKey}.examples.nameBased`)],
    ['$0 accounts use 1234567', i18n(`${i18nKey}.examples.idBased`)],
  ]);

  return yargs as Argv<AccountUseArgs>;
}
