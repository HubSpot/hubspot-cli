import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';

import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import {
  trackCommandMetadataUsage,
  trackCommandUsage,
} from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { ApiErrorContext, logError } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { migrateApp2025_2, MigrateAppArgs } from '../../lib/app/migrate';
import { uiBetaTag, uiCommandReference, uiLink } from '../../lib/ui';
import { migrateApp2023_2 } from '../../lib/app/migrate_legacy';
import { getIsInProject } from '../../lib/projects';

const { v2023_2, v2025_2, unstable } = PLATFORM_VERSIONS;
export const validMigrationTargets = [v2023_2, v2025_2, unstable];

const command = 'migrate';
const describe = undefined; // uiBetaTag(i18n(`commands.project.subcommands.migrateApp.header.text.describe`), false);

export async function handler(options: ArgumentsCamelCase<MigrateAppArgs>) {
  const { derivedAccountId, platformVersion } = options;
  await trackCommandUsage('migrate-app', {}, derivedAccountId);
  const accountConfig = getAccountConfig(derivedAccountId);

  if (!accountConfig) {
    logger.error(
      i18n(`commands.project.subcommands.migrateApp.errors.noAccountConfig`)
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  logger.log('');
  logger.log(
    uiBetaTag(
      i18n(`commands.project.subcommands.migrateApp.header.text`),
      false
    )
  );
  logger.log(
    uiLink(
      i18n(`commands.project.subcommands.migrateApp.header.link`),
      'https://developers.hubspot.com/docs/platform/migrate-a-public-app-to-projects'
    )
  );
  logger.log('');

  try {
    if (platformVersion === v2025_2 || platformVersion === unstable) {
      if (getIsInProject()) {
        logger.error(
          i18n(
            `commands.project.subcommands.migrateApp.errors.notAllowedWithinProject`,
            { command: uiCommandReference('hs project migrate') }
          )
        );
        process.exit(EXIT_CODES.ERROR);
      }

      await migrateApp2025_2(derivedAccountId, options);
    } else {
      await migrateApp2023_2(derivedAccountId, options, accountConfig);
    }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'errors' in error &&
      Array.isArray(error.errors)
    ) {
      error.errors.forEach(err => logError(err));
    } else {
      logError(error, new ApiErrorContext({ accountId: derivedAccountId }));
    }
    await trackCommandMetadataUsage(
      'migrate-app',
      { successful: false },
      derivedAccountId
    );
    process.exit(EXIT_CODES.ERROR);
  }

  await trackCommandMetadataUsage(
    'migrate-app',
    { successful: true },
    derivedAccountId
  );
  return process.exit(EXIT_CODES.SUCCESS);
}

export function builder(yargs: Argv): Argv<MigrateAppArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.options({
    name: {
      describe: i18n(
        `commands.project.subcommands.migrateApp.options.name.describe`
      ),
      type: 'string',
    },
    dest: {
      describe: i18n(
        `commands.project.subcommands.migrateApp.options.dest.describe`
      ),
      type: 'string',
    },
    'app-id': {
      describe: i18n(
        `commands.project.subcommands.migrateApp.options.appId.describe`
      ),
      type: 'number',
    },
    'platform-version': {
      type: 'string',
      choices: validMigrationTargets,
      hidden: true,
      default: '2023.2',
    },
  });

  yargs.example([
    [
      `$0 app migrate`,
      i18n(`commands.project.subcommands.migrateApp.examples.default`),
    ],
  ]);

  return yargs as Argv<MigrateAppArgs>;
}

const migrateCommand: CommandModule<unknown, MigrateAppArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default migrateCommand;
