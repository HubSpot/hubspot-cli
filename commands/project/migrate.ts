import { ArgumentsCamelCase, Argv } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { migrateApp2025_2 } from '../../lib/app/migrate';
import { getProjectConfig } from '../../lib/projects/config';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { logError } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { makeYargsBuilder } from '../../lib/yargsUtils';
import { uiBetaTag, uiCommandReference } from '../../lib/ui';
import { commands } from '../../lang/en';

export type ProjectMigrateArgs = CommonArgs &
  AccountArgs &
  EnvironmentArgs &
  ConfigArgs & {
    platformVersion: string;
    unstable: boolean;
  };

const { v2025_2 } = PLATFORM_VERSIONS;

const command = 'migrate';
const describe = undefined; // commands.project.migrate.describe

async function handler(
  args: ArgumentsCamelCase<ProjectMigrateArgs>
): Promise<void> {
  const { platformVersion, unstable } = args;
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
  const { derivedAccountId } = args;
  try {
    await migrateApp2025_2(
      derivedAccountId,
      {
        ...args,
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

function projectMigrateBuilder(yargs: Argv): Argv<ProjectMigrateArgs> {
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

const builder = makeYargsBuilder<ProjectMigrateArgs>(
  projectMigrateBuilder,
  command,
  commands.project.migrate.describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
  }
);

const migrateCommand: YargsCommandModule<unknown, ProjectMigrateArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default migrateCommand;
