import { i18n } from '../../lib/lang';
import { uiCommandReference, uiDeprecatedTag } from '../../lib/ui';
import {
  handler as migrateHandler,
  validMigrationTargets,
} from '../app/migrate';

import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import { MigrateAppArgs } from '../../lib/app/migrate';

export const command = 'migrate-app';

// TODO: Leave this as deprecated and remove in the next major release
export const describe = uiDeprecatedTag(
  i18n(`commands.project.subcommands.migrateApp.describe`),
  false
);
export const deprecated = true;

export async function handler(yargs: ArgumentsCamelCase<MigrateAppArgs>) {
  logger.warn(
    i18n(`commands.project.subcommands.migrateApp.deprecationWarning`, {
      oldCommand: uiCommandReference('hs project migrate-app'),
      newCommand: uiCommandReference('hs app migrate'),
    })
  );
  await migrateHandler(yargs);
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
      `$0 project migrate-app`,
      i18n(`commands.project.subcommands.migrateApp.examples.default`),
    ],
  ]);

  return yargs as Argv<MigrateAppArgs>;
}

const migrateAppCommand: CommandModule<unknown, MigrateAppArgs> = {
  command,
  describe,
  deprecated,
  handler,
  builder,
};

export default migrateAppCommand;
