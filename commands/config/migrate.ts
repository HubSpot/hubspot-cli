import { Argv, ArgumentsCamelCase } from 'yargs';
import fs from 'fs';
import {
  localConfigFileExists,
  globalConfigFileExists,
} from '@hubspot/local-dev-lib/config';
import { handleMigration, handleMerge } from '../../lib/configMigrate.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';

const describe = commands.config.subcommands.migrate.describe;
const command = 'migrate';

type ConfigMigrateArgs = CommonArgs & ConfigArgs & { force?: boolean };

async function handler(
  args: ArgumentsCamelCase<ConfigMigrateArgs>
): Promise<void> {
  const { config: configPath, force, exit } = args;

  if (configPath && !fs.existsSync(configPath)) {
    uiLogger.error(
      commands.config.subcommands.migrate.errors.configNotFound(configPath)
    );
    return exit(EXIT_CODES.ERROR);
  }

  const deprecatedConfigExists = localConfigFileExists();
  const globalConfigExists = globalConfigFileExists();

  if (!deprecatedConfigExists) {
    uiLogger.error(
      commands.config.subcommands.migrate.errors.noConfigToMigrate
    );
    return exit(EXIT_CODES.ERROR);
  }

  let success = false;
  try {
    if (!globalConfigExists) {
      success = await handleMigration(true);
    } else {
      success = await handleMerge(force, true);
    }
  } catch (error) {
    logError(error);
  }

  return exit(success ? EXIT_CODES.SUCCESS : EXIT_CODES.ERROR);
}

function configMigrateBuilder(yargs: Argv): Argv<ConfigMigrateArgs> {
  return yargs
    .option({
      force: {
        alias: 'f',
        type: 'boolean',
        default: false,
        description: commands.config.subcommands.migrate.options.force,
      },
    })
    .example([
      [
        '$0 config migrate',
        commands.config.subcommands.migrate.examples.default,
      ],
      [
        '$0 config migrate --config=/path/to/config.yml',
        commands.config.subcommands.migrate.examples.configFlag,
      ],
    ]) as Argv<ConfigMigrateArgs>;
}

const builder = makeYargsBuilder<ConfigMigrateArgs>(
  configMigrateBuilder,
  command,
  commands.config.subcommands.migrate.verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const configMigrateCommand: YargsCommandModule<unknown, ConfigMigrateArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('config-migrate', handler),
  builder,
};

export default configMigrateCommand;
