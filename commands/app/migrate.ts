import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import { PLATFORM_VERSIONS } from '@hubspot/project-parsing-lib/constants';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { trackCommandMetadataUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { ApiErrorContext, logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { migrateApp, MigrateAppArgs } from '../../lib/app/migrate.js';
import { getIsInProject } from '../../lib/projects/config.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const { v2025_2, v2026_03_BETA, v2026_03 } = PLATFORM_VERSIONS;

const command = 'migrate';
const describe = commands.project.migrateApp.describe;

export function handlerGenerator(
  commandTrackingName: string
): (args: ArgumentsCamelCase<MigrateAppArgs>) => Promise<void> {
  return async function handler(
    args: ArgumentsCamelCase<MigrateAppArgs>
  ): Promise<void> {
    const { derivedAccountId, platformVersion, unstable, exit } = args;
    const accountConfig = getConfigAccountById(derivedAccountId);

    if (!accountConfig) {
      uiLogger.error(commands.project.migrateApp.errors.noAccountConfig);
      return exit(EXIT_CODES.ERROR);
    }

    uiLogger.log('');
    uiLogger.log(commands.project.migrateApp.header);
    uiLogger.log('');

    try {
      if (getIsInProject()) {
        uiLogger.error(
          commands.project.migrateApp.errors.notAllowedWithinProject
        );
        return exit(EXIT_CODES.ERROR);
      }

      args.platformVersion = unstable
        ? PLATFORM_VERSIONS.UNSTABLE
        : platformVersion;

      await migrateApp(derivedAccountId, args);
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
      return exit(EXIT_CODES.ERROR);
    }

    await trackCommandMetadataUsage(
      commandTrackingName,
      { successful: true },
      derivedAccountId
    );
    return exit(EXIT_CODES.SUCCESS);
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
      choices: [v2025_2, v2026_03_BETA, v2026_03],
      default: v2026_03,
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
  handler: makeYargsHandlerWithUsageTracking('app-migrate', handler),
  builder,
};

export default migrateCommand;
