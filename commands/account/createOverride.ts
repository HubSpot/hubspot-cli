import fs from 'fs-extra';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import {
  getConfigFilePath,
  getConfigAccountIfExists,
  globalConfigFileExists,
} from '@hubspot/local-dev-lib/config';
import {
  getDefaultAccountOverrideAccountId,
  getDefaultAccountOverrideFilePath,
} from '@hubspot/local-dev-lib/config/defaultAccountOverride';

import { promptUser } from '../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';

const command = 'create-override [account]';
const describe = commands.account.subcommands.createOverride.describe(
  DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME
);

type AccountCreateOverrideArgs = CommonArgs & {
  account: string | number;
};

async function handler(
  args: ArgumentsCamelCase<AccountCreateOverrideArgs>
): Promise<void> {
  let overrideDefaultAccount = args.account;

  const globalConfigExists = globalConfigFileExists();
  if (!globalConfigExists) {
    uiLogger.error(
      commands.account.subcommands.createOverride.errors.globalConfigNotFound
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const accountOverrideId = getDefaultAccountOverrideAccountId();
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (accountOverrideId && overrideFilePath) {
    uiLogger.log(
      commands.account.subcommands.createOverride.accountOverride(
        overrideFilePath,
        accountOverrideId.toString()
      )
    );

    const { replaceOverrideFile } = await promptUser({
      type: 'confirm',
      name: 'replaceOverrideFile',
      message:
        commands.account.subcommands.createOverride.prompts.replaceOverrideFile,
    });
    uiLogger.log('');

    if (!replaceOverrideFile) {
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  if (!overrideDefaultAccount) {
    overrideDefaultAccount = await selectAccountFromConfig();
  } else {
    const account = getConfigAccountIfExists(overrideDefaultAccount);
    if (!account) {
      uiLogger.error(
        commands.account.subcommands.createOverride.errors.accountNotFound(
          getConfigFilePath() || ''
        )
      );
      overrideDefaultAccount = await selectAccountFromConfig();
    }
  }
  const account = getConfigAccountIfExists(overrideDefaultAccount);
  const accountId = account?.accountId;

  trackCommandUsage('account-createOverride', undefined, accountId!);

  try {
    const overrideFilePath = path.join(
      getCwd(),
      DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME
    );
    await fs.writeFile(overrideFilePath, accountId!.toString(), 'utf8');
    uiLogger.success(
      commands.account.subcommands.createOverride.success(overrideFilePath)
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
    describe:
      commands.account.subcommands.createOverride.options.account.describe,
    type: 'string',
  });
  yargs.example([
    [
      '$0 account create-override',
      commands.account.subcommands.createOverride.examples.default(
        DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME
      ),
    ],
    [
      '$0 account create-override 12345678',
      commands.account.subcommands.createOverride.examples.idBased(
        DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME
      ),
    ],
    [
      '$0 account create-override MyAccount',
      commands.account.subcommands.createOverride.examples.nameBased(
        DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME
      ),
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
