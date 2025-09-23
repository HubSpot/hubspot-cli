import fs from 'fs-extra';
import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getCWDAccountOverride,
  getDefaultAccountOverrideFilePath,
  getAccountId,
} from '@hubspot/local-dev-lib/config';
import { DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import { getGlobalConfig } from '@hubspot/local-dev-lib/config/migrate';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { trackCommandMetadataUsage } from '../../lib/usageTracking.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';

const command = 'remove-override';
const describe = commands.account.subcommands.removeOverride.describe(
  DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME
);

type RemoveOverrideArgs = CommonArgs & { force?: boolean };

async function handler(
  args: ArgumentsCamelCase<RemoveOverrideArgs>
): Promise<void> {
  const { force } = args;

  const globalConfig = getGlobalConfig();
  if (!globalConfig) {
    uiLogger.error(
      commands.account.subcommands.removeOverride.errors.globalConfigNotFound
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const accountOverride = getCWDAccountOverride();
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (accountOverride && overrideFilePath) {
    const accountId = getAccountId(accountOverride) || undefined;

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
        trackCommandMetadataUsage(
          'account-removeOverride',
          {
            command: 'hs account remove-override',
            step: 'Reject removing override via prompt',
          },
          accountId
        );
        process.exit(EXIT_CODES.SUCCESS);
      }
    }

    try {
      fs.unlinkSync(overrideFilePath);
      uiLogger.success(commands.account.subcommands.removeOverride.success);
      trackCommandMetadataUsage(
        'account-removeOverride',
        {
          command: 'hs account remove-override',
          step: 'Confirm removing override file (via prompt/force)',
          successful: true,
        },
        accountId
      );
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      logError(error);
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    uiLogger.log(commands.account.subcommands.removeOverride.noOverrideFile);
    process.exit(EXIT_CODES.SUCCESS);
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
  handler,
  builder,
};

export default accountRemoveOverrideCommand;
