import { ArgumentsCamelCase, Argv } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { i18n } from '../../lib/lang';
import { uiCommandReference, uiDeprecatedTag } from '../../lib/ui';
import { handler as migrateHandler } from '../app/migrate';
import { YargsCommandModule } from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';
import { MigrateAppArgs } from '../../lib/app/migrate';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';

const { v2023_2, v2025_2 } = PLATFORM_VERSIONS;

const command = 'migrate-app';

// TODO: Leave this as deprecated and remove in the next major release
const describe = uiDeprecatedTag(
  i18n(`commands.project.subcommands.migrateApp.describe`),
  false
);
const deprecated = true;

async function handler(
  args: ArgumentsCamelCase<MigrateAppArgs>
): Promise<void> {
  logger.warn(
    i18n(`commands.project.subcommands.migrateApp.deprecationWarning`, {
      oldCommand: uiCommandReference('hs project migrate-app'),
      newCommand: uiCommandReference(
        `hs app migrate --platform-version=${args.platformVersion}`
      ),
    })
  );
  await migrateHandler(args);
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
