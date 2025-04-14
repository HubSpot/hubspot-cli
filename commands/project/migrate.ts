import { i18n } from '../../lib/lang';

import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { ProjectMigrateOptions } from '../../types/Yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addGlobalOptions,
} from '../../lib/commonOpts';
import { migrateApp2025_2 } from '../../lib/app/migrate';
import { getProjectConfig } from '../../lib/projects';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { logError } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';

export const command = 'migrate';

export const describe = undefined; // i18n('commands.project.subcommands.migrate.noProjectConfig')

export async function handler(
  options: ArgumentsCamelCase<ProjectMigrateOptions>
) {
  const projectConfig = await getProjectConfig();

  if (!projectConfig.projectConfig) {
    logger.error(
      i18n('commands.project.subcommands.migrate.errors.noProjectConfig')
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  const { derivedAccountId } = options;
  try {
    await migrateApp2025_2(
      derivedAccountId,
      {
        ...options,
        name: projectConfig?.projectConfig?.name,
        platformVersion: PLATFORM_VERSIONS.unstable,
      },
      projectConfig
    );
  } catch (error) {
    logError(error);
    return process.exit(EXIT_CODES.ERROR);
  }
  return process.exit(EXIT_CODES.SUCCESS);
}

export function builder(yargs: Argv) {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addGlobalOptions(yargs);

  return yargs as Argv<ProjectMigrateOptions>;
}
const migrateAppCommand: CommandModule<unknown, ProjectMigrateOptions> = {
  command,
  describe,
  handler,
  builder,
};

export default migrateAppCommand;
