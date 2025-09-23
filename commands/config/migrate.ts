import { Argv, ArgumentsCamelCase } from 'yargs';
import fs from 'fs';
import { configFileExists } from '@hubspot/local-dev-lib/config/migrate';
import { handleMigration, handleMerge } from '../../lib/configMigrate.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';

const describe = commands.config.subcommands.migrate.describe;
const command = 'migrate';

type ConfigMigrateArgs = CommonArgs & ConfigArgs & { force?: boolean };

async function handler(
  args: ArgumentsCamelCase<ConfigMigrateArgs>
): Promise<void> {
  const { derivedAccountId, config: configPath, force } = args;

  trackCommandUsage('config-migrate', {}, derivedAccountId);

  if (configPath && !fs.existsSync(configPath)) {
    uiLogger.error(
      commands.config.subcommands.migrate.errors.configNotFound(configPath)
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const deprecatedConfigExists = configFileExists(false, configPath);
  const globalConfigExists = configFileExists(true);

  if (!deprecatedConfigExists) {
    uiLogger.error(
      commands.config.subcommands.migrate.errors.noConfigToMigrate
    );
    process.exit(EXIT_CODES.ERROR);
  }

  let success = false;
  try {
    if (!globalConfigExists) {
      success = await handleMigration(configPath, true);
    } else {
      success = await handleMerge(configPath, force, true);
    }
  } catch (error) {
    logError(error);
  }

  process.exit(success ? EXIT_CODES.SUCCESS : EXIT_CODES.ERROR);
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
  handler,
  builder,
};

export default configMigrateCommand;
