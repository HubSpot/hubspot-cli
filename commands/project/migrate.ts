import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../../types/Yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addGlobalOptions,
} from '../../lib/commonOpts';
import { migrateApp2025_2 } from '../../lib/app/migrate';
import { getProjectConfig } from '../../lib/projects/config';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { logError } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { uiBetaTag, uiCommandReference } from '../../lib/ui';
import { commands } from '../../lang/en';

export type ProjectMigrateArgs = CommonArgs &
  AccountArgs &
  EnvironmentArgs &
  ConfigArgs & {
    platformVersion: string;
  };

const { v2025_2 } = PLATFORM_VERSIONS;

export const command = 'migrate';

export const describe = undefined;

export async function handler(
  options: ArgumentsCamelCase<ProjectMigrateArgs>
): Promise<void> {
  const { platformVersion, unstable } = options;
  const projectConfig = await getProjectConfig();

  if (!projectConfig.projectConfig) {
    logger.error(
      commands.project.migrate.errors.noProjectConfig(
        uiCommandReference('hs app migrate')
      )
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  logger.log();
  logger.log(
    uiBetaTag(commands.project.migrate.preamble(platformVersion), false)
  );

  const { derivedAccountId } = options;
  try {
    await migrateApp2025_2(
      derivedAccountId,
      {
        ...options,
        name: projectConfig?.projectConfig?.name,
        platformVersion: unstable
          ? PLATFORM_VERSIONS.unstable
          : platformVersion,
      },
      projectConfig
    );
  } catch (error) {
    logError(error);
    return process.exit(EXIT_CODES.ERROR);
  }
  return process.exit(EXIT_CODES.SUCCESS);
}

export function builder(yargs: Argv): Argv<ProjectMigrateArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addGlobalOptions(yargs);

  yargs
    .option('platform-version', {
      type: 'string',
      choices: [v2025_2],
      default: v2025_2,
      hidden: true,
    })
    .option('unstable', {
      type: 'boolean',
      default: false,
      hidden: true,
    });

  return yargs as Argv<ProjectMigrateArgs>;
}
const migrateAppCommand: CommandModule<unknown, ProjectMigrateArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default migrateAppCommand;
