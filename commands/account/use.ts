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
import { CommonArgs, YargsCommandModule } from '../../types/Yargs';
import { uiCommandReference } from '../../lib/ui';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'use [account]';
const describe = i18n('commands.account.subcommands.use.describe');

type AccountUseArgs = CommonArgs & {
  account?: string;
};

async function handler(
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

  const accountOverride = getCWDAccountOverride();
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (accountOverride && overrideFilePath) {
    logger.warn(
      i18n(`commands.account.subcommands.use.accountOverride`, {
        accountOverride,
      })
    );
    logger.log(
      i18n(`commands.account.subcommands.use.accountOverrideCommands`, {
        createOverrideCommand: uiCommandReference('hs account create-override'),
        removeOverrideCommand: uiCommandReference('hs account remove-override'),
      })
    );
    logger.log('');
  }

  updateDefaultAccount(newDefaultAccount);

  return logger.success(
    i18n('commands.account.subcommands.use.success.defaultAccountUpdated', {
      accountName: newDefaultAccount,
    })
  );
}

function accountUseBuilder(yargs: Argv): Argv<AccountUseArgs> {
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

const builder = makeYargsBuilder<AccountUseArgs>(
  accountUseBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const accountUseCommand: YargsCommandModule<unknown, AccountUseArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default accountUseCommand;
