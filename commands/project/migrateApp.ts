import { ArgumentsCamelCase, Argv } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { i18n } from '../../lib/lang';
import { uiCommandReference, uiDeprecatedTag } from '../../lib/ui';
import {
  handler as migrateHandler,
  validMigrationTargets,
} from '../app/migrate';
import { YargsCommandModule } from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';
import { MigrateAppArgs } from '../../lib/app/migrate';

const command = 'migrate-app';

// TODO: Leave this as deprecated and remove in the next major release
const describe = uiDeprecatedTag(
  i18n(`commands.project.subcommands.migrateApp.describe`),
  false
);
export const deprecated = true;

async function handler(yargs: ArgumentsCamelCase<MigrateAppArgs>) {
  logger.warn(
    i18n(`commands.project.subcommands.migrateApp.deprecationWarning`, {
      oldCommand: uiCommandReference('hs project migrate-app'),
      newCommand: uiCommandReference('hs app migrate'),
    })
  );
  await migrateHandler(yargs);
}

function projectMigrateAppBuilder(yargs: Argv): Argv<MigrateAppArgs> {
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

const builder = makeYargsBuilder<MigrateAppArgs>(
  projectMigrateAppBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const migrateAppCommand: YargsCommandModule<unknown, MigrateAppArgs> = {
  command,
  describe,
  deprecated,
  handler,
  builder,
};

export default migrateAppCommand;
