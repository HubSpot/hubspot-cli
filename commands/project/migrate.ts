import { i18n } from '../../lib/lang';

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
import { getProjectConfig } from '../../lib/projects';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { logError } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { makeYargsBuilder } from '../../lib/yargsUtils';

export type ProjectMigrateArgs = CommonArgs &
  AccountArgs &
  EnvironmentArgs &
  ConfigArgs & {
    platformVersion: string;
  };

const command = 'migrate';
const describe = undefined; // i18n('commands.project.subcommands.migrate.describe')

async function handler(
  args: ArgumentsCamelCase<ProjectMigrateArgs>
): Promise<void> {
  const projectConfig = await getProjectConfig();

  if (!projectConfig.projectConfig) {
    logger.error(
      i18n('commands.project.subcommands.migrate.errors.noProjectConfig')
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  const { derivedAccountId } = args;
  try {
    await migrateApp2025_2(
      derivedAccountId,
      {
        ...args,
        name: projectConfig?.projectConfig?.name,
        platformVersion: args.platformVersion,
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
  yargs.option('platform-version', {
    type: 'string',
    choices: Object.values(PLATFORM_VERSIONS),
    default: PLATFORM_VERSIONS.v2025_2,
    hidden: true,
  });

  return yargs as Argv<ProjectMigrateArgs>;
}

const builder = makeYargsBuilder<ProjectMigrateArgs>(
  projectMigrateBuilder,
  command,
  i18n('commands.project.subcommands.migrate.describe'),
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
