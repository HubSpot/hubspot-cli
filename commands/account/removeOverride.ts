import fs from 'fs-extra';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getCWDAccountOverride,
  getDefaultAccountOverrideFilePath,
  getAccountId,
} from '@hubspot/local-dev-lib/config';
import {
  DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME,
  GLOBAL_CONFIG_PATH,
} from '@hubspot/local-dev-lib/constants/config';
import { getGlobalConfig } from '@hubspot/local-dev-lib/config/migrate';

import { i18n } from '../../lib/lang';
import { promptUser } from '../../lib/prompts/promptUtils';
import { trackCommandMetadataUsage } from '../../lib/usageTracking';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { logError } from '../../lib/errorHandlers/index';
import { CommonArgs } from '../../types/Yargs';
import { uiCommandReference } from '../../lib/ui';

export const describe = i18n(
  'commands.account.subcommands.removeOverride.describe',
  {
    overrideFile: DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME,
  }
);

export const command = 'remove-override';

type RemoveOverrideArgs = CommonArgs & { force?: boolean };

export async function handler(
  args: ArgumentsCamelCase<RemoveOverrideArgs>
): Promise<void> {
  const { force } = args;

  const globalConfig = getGlobalConfig();
  if (!globalConfig) {
    logger.error(
      i18n(
        'commands.account.subcommands.createOverride.errors.globalConfigNotFound',
        {
          globalConfigPath: GLOBAL_CONFIG_PATH,
          authCommand: uiCommandReference('hs account auth'),
        }
      )
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const accountOverride = getCWDAccountOverride();
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (accountOverride && overrideFilePath) {
    const accountId = getAccountId(accountOverride) || undefined;

    if (!force) {
      logger.log(
        i18n('commands.account.subcommands.removeOverride.accountOverride', {
          accountOverride,
          overrideFilePath,
        })
      );

      const { deleteOverrideFile } = await promptUser({
        type: 'confirm',
        name: 'deleteOverrideFile',
        message: i18n(
          'commands.account.subcommands.removeOverride.prompts.deleteOverrideFile',
          {
            accountOverride,
            overrideFilePath,
          }
        ),
      });
      logger.log('');

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
      logger.success(
        i18n('commands.account.subcommands.removeOverride.success')
      );
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
    logger.log(
      i18n('commands.account.subcommands.removeOverride.noOverrideFile')
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}

export function builder(yargs: Argv): Argv<RemoveOverrideArgs> {
  yargs.options('force', {
    describe: i18n(
      'commands.account.subcommands.removeOverride.options.force.describe'
    ),
    type: 'boolean',
  });

  return yargs as Argv<RemoveOverrideArgs>;
}
