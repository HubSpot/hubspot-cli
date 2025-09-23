import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { YargsCommandModule } from '../../types/Yargs.js';
import {
  trackCommandMetadataUsage,
  trackCommandUsage,
} from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { ApiErrorContext, logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { migrateApp2025_2, MigrateAppArgs } from '../../lib/app/migrate.js';
import { migrateApp2023_2 } from '../../lib/app/migrate_legacy.js';
import { getIsInProject } from '../../lib/projects/config.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const { v2023_2, v2025_2 } = PLATFORM_VERSIONS;

const command = 'migrate';
const describe = commands.project.migrateApp.describe;

export function handlerGenerator(
  commandTrackingName: string
): (args: ArgumentsCamelCase<MigrateAppArgs>) => Promise<void> {
  return async function handler(
    args: ArgumentsCamelCase<MigrateAppArgs>
  ): Promise<void> {
    const { derivedAccountId, platformVersion, unstable } = args;
    await trackCommandUsage(commandTrackingName, {}, derivedAccountId);
    const accountConfig = getAccountConfig(derivedAccountId);

    if (!accountConfig) {
      uiLogger.error(commands.project.migrateApp.errors.noAccountConfig);
      return process.exit(EXIT_CODES.ERROR);
    }

    uiLogger.log('');
    uiLogger.log(commands.project.migrateApp.header);
    uiLogger.log('');

    try {
      if (platformVersion === v2025_2 || unstable) {
        if (getIsInProject()) {
          uiLogger.error(
            commands.project.migrateApp.errors.notAllowedWithinProject
          );
          return process.exit(EXIT_CODES.ERROR);
        }

        args.platformVersion = unstable
          ? PLATFORM_VERSIONS.unstable
          : platformVersion;

        await migrateApp2025_2(derivedAccountId, args);
      } else {
        await migrateApp2023_2(derivedAccountId, args, accountConfig);
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

const handler = handlerGenerator('app-migrate');

function appMigrateBuilder(yargs: Argv): Argv<MigrateAppArgs> {
  yargs.options({
    name: {
      describe: commands.project.migrateApp.options.name.describe,
      type: 'string',
    },
    dest: {
      describe: commands.project.migrateApp.options.dest.describe,
      type: 'string',
    },
    'app-id': {
      describe: commands.project.migrateApp.options.appId.describe,
      type: 'number',
    },
    'platform-version': {
      type: 'string',
      choices: [v2023_2, v2025_2],
      default: v2025_2,
    },
    unstable: {
      type: 'boolean',
      default: false,
      hidden: true,
    },
  });

  yargs.example([
    [`$0 app migrate`, commands.project.migrateApp.examples.default],
  ]);

  return yargs as Argv<MigrateAppArgs>;
}

const builder = makeYargsBuilder<MigrateAppArgs>(
  appMigrateBuilder,
  command,
  commands.project.migrateApp.describe,
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
