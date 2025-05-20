import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { YargsCommandModule } from '../../types/Yargs';
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
import { getIsInProject } from '../../lib/projects/config';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const { v2023_2, v2025_2 } = PLATFORM_VERSIONS;

const command = 'migrate';
const describe = undefined; // uiBetaTag(i18n(`commands.project.subcommands.migrateApp.header.text.describe`), false);

export function handlerGenerator(
  commandTrackingName: string
): (options: ArgumentsCamelCase<MigrateAppArgs>) => Promise<void> {
  return async function handler(options: ArgumentsCamelCase<MigrateAppArgs>) {
    const { derivedAccountId, platformVersion, unstable } = options;
    await trackCommandUsage(commandTrackingName, {}, derivedAccountId);
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
      if (platformVersion === v2025_2 || unstable) {
        if (getIsInProject()) {
          logger.error(
            i18n(
              `commands.project.subcommands.migrateApp.errors.notAllowedWithinProject`,
              { command: uiCommandReference('hs project migrate') }
            )
          );
          return process.exit(EXIT_CODES.ERROR);
        }

        options.platformVersion = unstable
          ? PLATFORM_VERSIONS.unstable
          : platformVersion;

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
        commandTrackingName,
        { successful: false },
        derivedAccountId
      );
      return process.exit(EXIT_CODES.ERROR);
    }

    await trackCommandMetadataUsage(
      commandTrackingName,
      { successful: true },
      derivedAccountId
    );
    return process.exit(EXIT_CODES.SUCCESS);
  };
}

export const handler = handlerGenerator('app-migrate');

function appMigrateBuilder(yargs: Argv): Argv<MigrateAppArgs> {
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
      choices: [v2023_2, v2025_2],
      hidden: true,
      default: v2025_2,
    },
    unstable: {
      type: 'boolean',
      default: false,
      hidden: true,
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

const builder = makeYargsBuilder<MigrateAppArgs>(
  appMigrateBuilder,
  command,
  uiBetaTag(i18n(`commands.project.subcommands.migrateApp.describe`), false),
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const migrateCommand: YargsCommandModule<unknown, MigrateAppArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default migrateCommand;
