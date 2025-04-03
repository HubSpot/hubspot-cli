import { i18n } from '../../lib/lang';

import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { ProjectMigrateOptions } from '../../types/Yargs';
import { addAccountOptions, addConfigOptions } from '../../lib/commonOpts';
import { migrateApp2025_2 } from '../../lib/app/migrate';
import { getProjectConfig } from '../../lib/projects';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/platformVersion';

export const command = 'migrate';

export const describe = undefined;

// TODO: Add i18n keys
export async function handler(
  options: ArgumentsCamelCase<ProjectMigrateOptions>
) {
  const { projectConfig } = await getProjectConfig();

  if (!projectConfig) {
    logger.error(i18n('commands.project.subcommands.migrate.noProjectConfig'));
    return;
  }

  const { derivedAccountId } = options;
  await migrateApp2025_2(
    derivedAccountId,
    {
      ...options,
      name: projectConfig.name,
      platformVersion: PLATFORM_VERSIONS.unstable,
    },
    true
  );
}

export function builder(yargs: Argv) {
  addConfigOptions(yargs);
  addAccountOptions(yargs);

  return yargs as Argv<ProjectMigrateOptions>;
}
const migrateAppCommand: CommandModule<unknown, ProjectMigrateOptions> = {
  command,
  describe,
  handler,
  builder,
};

export default migrateAppCommand;
