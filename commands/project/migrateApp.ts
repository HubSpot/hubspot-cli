import { i18n } from '../../lib/lang';
import { uiCommandReference, uiDeprecatedTag } from '../../lib/ui';
import { handler as migrateHandler } from '../app/migrate';

import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import { MigrateAppArgs } from '../../lib/app/migrate';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';

const { v2023_2, v2025_2 } = PLATFORM_VERSIONS;
export const command = 'migrate-app';

// TODO: Leave this as deprecated and remove in the next major release
export const describe = uiDeprecatedTag(
  i18n(`commands.project.subcommands.migrateApp.describe`),
  false
);
export const deprecated = true;

export async function handler(options: ArgumentsCamelCase<MigrateAppArgs>) {
  logger.warn(
    i18n(`commands.project.subcommands.migrateApp.deprecationWarning`, {
      oldCommand: uiCommandReference('hs project migrate-app'),
      newCommand: uiCommandReference(
        `hs app migrate --platform-version=${options.platformVersion}`
      ),
    })
  );
  await migrateHandler(options);
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
      choices: [v2023_2, v2025_2],
      hidden: true,
      default: v2023_2,
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
