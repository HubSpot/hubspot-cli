import fs from 'fs-extra';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import {
  getCWDAccountOverride,
  getDefaultAccountOverrideFilePath,
  getConfigPath,
  getAccountId,
} from '@hubspot/local-dev-lib/config';
import { getGlobalConfig } from '@hubspot/local-dev-lib/config/migrate';

import { i18n } from '../../lib/lang';
import { promptUser } from '../../lib/prompts/promptUtils';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { trackCommandMetadataUsage } from '../../lib/usageTracking';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { logError } from '../../lib/errorHandlers/index';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs';
import { uiCommandReference } from '../../lib/ui';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'create-override [account]';
const describe = i18n('commands.account.subcommands.createOverride.describe', {
  hsAccountFileName: DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME,
});

type AccountCreateOverrideArgs = CommonArgs & {
  account: string | number;
};

async function handler(
  args: ArgumentsCamelCase<AccountCreateOverrideArgs>
): Promise<void> {
  let overrideDefaultAccount = args.account;

  const globalConfig = getGlobalConfig();
  if (!globalConfig) {
    logger.error(
      i18n(
        'commands.account.subcommands.createOverride.errors.globalConfigNotFound',
        {
          authCommand: uiCommandReference('hs account auth'),
        }
      )
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const accountOverride = getCWDAccountOverride();
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (accountOverride && overrideFilePath) {
    logger.log(
      i18n('commands.account.subcommands.createOverride.accountOverride', {
        accountOverride,
        overrideFilePath,
      })
    );

    const { replaceOverrideFile } = await promptUser({
      type: 'confirm',
      name: 'replaceOverrideFile',
      message: i18n(
        'commands.account.subcommands.createOverride.prompts.replaceOverrideFile'
      ),
    });
    logger.log('');

    if (!replaceOverrideFile) {
      const accountId = getAccountId(accountOverride) || undefined;
      trackCommandMetadataUsage(
        'account-createOverride',
        {
          command: 'hs account create-override',
          step: 'Reject overwriting an override via prompt',
        },
        accountId
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  if (!overrideDefaultAccount) {
    overrideDefaultAccount = await selectAccountFromConfig();
  } else if (!getAccountId(overrideDefaultAccount)) {
    logger.error(
      i18n(
        'commands.account.subcommands.createOverride.errors.accountNotFound',
        {
          configPath: getConfigPath() || '',
        }
      )
    );
    overrideDefaultAccount = await selectAccountFromConfig();
  }
  const accountId = getAccountId(overrideDefaultAccount);

  try {
    const overrideFilePath = path.join(
      getCwd(),
      DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME
    );
    await fs.writeFile(overrideFilePath, accountId!.toString(), 'utf8');
    logger.success(
      i18n('commands.account.subcommands.createOverride.success', {
        overrideFilePath,
      })
    );
    const trackingId = accountId || undefined;
    trackCommandMetadataUsage(
      'config-migrate',
      {
        command: 'hs config migrate',
        step: 'Confirm overwriting an override via prompt',
        successful: true,
      },
      trackingId
    );
    process.exit(EXIT_CODES.SUCCESS);
  } catch (e: unknown) {
    logError(e);
    process.exit(EXIT_CODES.ERROR);
  }
}

function accountCreateOverrideBuilder(
  yargs: Argv
): Argv<AccountCreateOverrideArgs> {
  yargs.positional('account', {
    describe: i18n(
      'commands.account.subcommands.createOverride.options.account.describe'
    ),
    type: 'string',
  });
  yargs.example([
    [
      '$0 account create-override',
      i18n('commands.account.subcommands.createOverride.examples.default', {
        hsAccountFileName: DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME,
      }),
    ],
    [
      '$0 account create-override 12345678',
      i18n('commands.account.subcommands.createOverride.examples.idBased', {
        hsAccountFileName: DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME,
      }),
    ],
    [
      '$0 account create-override MyAccount',
      i18n('commands.account.subcommands.createOverride.examples.nameBased', {
        hsAccountFileName: DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME,
      }),
    ],
  ]);

  return yargs as Argv<AccountCreateOverrideArgs>;
}

const builder = makeYargsBuilder<AccountCreateOverrideArgs>(
  accountCreateOverrideBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const accountCreateOverrideCommand: YargsCommandModule<
  unknown,
  AccountCreateOverrideArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default accountCreateOverrideCommand;
