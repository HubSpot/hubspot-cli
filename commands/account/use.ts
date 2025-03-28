import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getConfigPath,
  updateDefaultAccount,
  getAccountId,
  getCWDAccountOverride,
  getDefaultAccountOverrideFilePath,
} from '@hubspot/local-dev-lib/config';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { CommonArgs } from '../../types/Yargs';
import { uiCommandReference } from '../../lib/ui';

const i18nKey = 'commands.account.subcommands.use';

export const command = 'use [account]';
export const describe = i18n(`${i18nKey}.describe`);

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
      i18n(`${i18nKey}.errors.accountNotFound`, {
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

  const accountOverride = getCWDAccountOverride();
  const overrideFilePath = getDefaultAccountOverrideFilePath();

  if (accountOverride && overrideFilePath) {
    logger.log(
      i18n(`${i18nKey}.accountOverride`, {
        accountOverride,
        overrideFilePath,
      })
    );
    logger.log(
      i18n(`${i18nKey}.accountOverrideCommands`, {
        createOverrideCommand: uiCommandReference('hs account create-override'),
        removeOverrideCommand: uiCommandReference('hs account remove-override'),
      })
    );
    logger.log('');
  }

  updateDefaultAccount(newDefaultAccount);

  return logger.success(
    i18n(`${i18nKey}.success.defaultAccountUpdated`, {
      accountName: newDefaultAccount,
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
