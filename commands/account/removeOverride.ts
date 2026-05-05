import fs from 'fs-extra';
import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  globalConfigFileExists,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import {
  getDefaultAccountOverrideAccountId,
  getDefaultAccountOverrideFilePath,
} from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import { DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';
import { warnIfLinkedDirectory } from '../../lib/link/warnIfLinkedDirectory.js';

const command = 'remove-override';
const describe = commands.account.subcommands.removeOverride.describe(
  DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME
);

type RemoveOverrideArgs = CommonArgs & { force?: boolean };

async function handler(
  args: ArgumentsCamelCase<RemoveOverrideArgs>
): Promise<void> {
  const { force, exit } = args;

  // TODO: Block this command when linked directory exists (next breaking change)
  warnIfLinkedDirectory(args._);

  const globalConfigExists = globalConfigFileExists();
  if (!globalConfigExists) {
    uiLogger.error(
      commands.account.subcommands.removeOverride.errors.globalConfigNotFound
    );
    return exit(EXIT_CODES.ERROR);
  }

  const accounts = getAllConfigAccounts();
  const accountOverride = getDefaultAccountOverrideAccountId(accounts);
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (accountOverride && overrideFilePath) {
    if (!force) {
      uiLogger.log(
        commands.account.subcommands.removeOverride.accountOverride(
          overrideFilePath,
          accountOverride.toString()
        )
      );

      const { deleteOverrideFile } = await promptUser({
        type: 'confirm',
        name: 'deleteOverrideFile',
        message:
          commands.account.subcommands.removeOverride.prompts
            .deleteOverrideFile,
      });
      uiLogger.log('');

      if (!deleteOverrideFile) {
        return exit(EXIT_CODES.SUCCESS);
      }
    }

    try {
      fs.unlinkSync(overrideFilePath);
      uiLogger.success(commands.account.subcommands.removeOverride.success);
      return exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      logError(error);
      return exit(EXIT_CODES.ERROR);
    }
  } else {
    uiLogger.log(commands.account.subcommands.removeOverride.noOverrideFile);
    return exit(EXIT_CODES.SUCCESS);
  }
}

function accountRemoveOverrideBuilder(yargs: Argv): Argv<RemoveOverrideArgs> {
  yargs.options('force', {
    describe:
      commands.account.subcommands.removeOverride.options.force.describe,
    type: 'boolean',
  });

  return yargs as Argv<RemoveOverrideArgs>;
}

const builder = makeYargsBuilder<RemoveOverrideArgs>(
  accountRemoveOverrideBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const accountRemoveOverrideCommand: YargsCommandModule<
  unknown,
  RemoveOverrideArgs
> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('account-removeOverride', handler),
  builder,
};

export default accountRemoveOverrideCommand;
