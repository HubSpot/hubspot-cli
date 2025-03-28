import fs from 'fs-extra';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getCWDAccountOverride,
  getDefaultAccountOverrideFilePath,
} from '@hubspot/local-dev-lib/config';

import { i18n } from '../../lib/lang';
import { promptUser } from '../../lib/prompts/promptUtils';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { logError } from '../../lib/errorHandlers/index';
import { CommonArgs } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.removeOverride';

export const describe = undefined; // i18n(`${i18nKey}.describe`, {overrideFile: DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME,});

export const command = 'remove-override';

type RemoveOverrideArgs = CommonArgs & { force?: boolean };

export async function handler(
  args: ArgumentsCamelCase<RemoveOverrideArgs>
): Promise<void> {
  const { force } = args;

  const accountOverride = getCWDAccountOverride();
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (accountOverride && overrideFilePath) {
    if (!force) {
      logger.log(
        i18n(`${i18nKey}.accountOverride`, {
          accountOverride,
          overrideFilePath,
        })
      );

      const { deleteOverrideFile } = await promptUser({
        type: 'confirm',
        name: 'deleteOverrideFile',
        message: i18n(`${i18nKey}.prompts.deleteOverrideFile`, {
          accountOverride,
          overrideFilePath,
        }),
      });

      if (!deleteOverrideFile) {
        process.exit(EXIT_CODES.SUCCESS);
      }
    }

    try {
      fs.unlinkSync(overrideFilePath);
      logger.success(i18n(`${i18nKey}.success`));
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      logError(error);
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    logger.log(i18n(`${i18nKey}.noOverrideFile`));
    process.exit(EXIT_CODES.SUCCESS);
  }
}

export function builder(yargs: Argv): Argv<RemoveOverrideArgs> {
  yargs.options('force', {
    describe: i18n(`${i18nKey}.options.force.describe`),
    type: 'boolean',
  });

  return yargs as Argv<RemoveOverrideArgs>;
}
