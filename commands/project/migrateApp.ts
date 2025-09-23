import { ArgumentsCamelCase, Argv } from 'yargs';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';
import { uiDeprecatedTag } from '../../lib/ui/index.js';
import { handlerGenerator } from '../app/migrate.js';
import { YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { MigrateAppArgs } from '../../lib/app/migrate.js';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';

const { v2023_2, v2025_2 } = PLATFORM_VERSIONS;

const command = 'migrate-app';

// TODO: Leave this as deprecated and remove in the next major release
const describe = uiDeprecatedTag(commands.project.migrateApp.describe, false);
const deprecated = true;

async function handler(
  args: ArgumentsCamelCase<MigrateAppArgs>
): Promise<void> {
  uiLogger.warn(
    commands.project.migrateApp.deprecationWarning(args.platformVersion)
  );
  const localHandler = handlerGenerator('migrate-app');
  await localHandler(args);
}

function projectMigrateAppBuilder(yargs: Argv): Argv<MigrateAppArgs> {
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
      choices: [v2023_2, v2025_2],
      default: v2025_2,
    },
  });

  yargs.example([
    [`$0 project migrate-app`, commands.project.migrateApp.examples.default],
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
