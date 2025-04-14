import { Argv, ArgumentsCamelCase } from 'yargs';
import fs from 'fs';
import {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  GLOBAL_CONFIG_PATH,
} from '@hubspot/local-dev-lib/constants/config';
import { configFileExists } from '@hubspot/local-dev-lib/config/migrate';
import { logger } from '@hubspot/local-dev-lib/logger';

import { handleMigration, handleMerge } from '../../lib/configMigrate';
import { addConfigOptions } from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';
import { trackCommandMetadataUsage } from '../../lib/usageTracking';
import { logError } from '../../lib/errorHandlers/index';
import { EXIT_CODES } from '../../lib/enums/exitCodes';

export const describe = i18n('commands.config.subcommands.migrate.describe', {
  deprecatedConfigPath: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  globalConfigPath: GLOBAL_CONFIG_PATH,
});
export const command = 'migrate';

type ConfigMigrateArgs = CommonArgs & ConfigArgs & { force?: boolean };

export async function handler(
  args: ArgumentsCamelCase<ConfigMigrateArgs>
): Promise<void> {
  const { config: configPath, force, derivedAccountId } = args;

  if (configPath && !fs.existsSync(configPath)) {
    logger.log(
      i18n('commands.config.subcommands.migrate.errors.configNotFound', {
        configPath,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const deprecatedConfigExists = configFileExists(false, configPath);
  const globalConfigExists = configFileExists(true);

  if (!deprecatedConfigExists) {
    logger.log(
      i18n('commands.config.subcommands.migrate.migrationAlreadyCompleted', {
        deprecatedConfigPath: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }

  try {
    if (!globalConfigExists) {
      await handleMigration(derivedAccountId, configPath);
    } else {
      await handleMerge(derivedAccountId, configPath, force);
    }
    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    trackCommandMetadataUsage(
      'config-migrate',
      {
        command: 'hs config migrate',
        type: 'Migration/merge',
        successful: false,
      },
      derivedAccountId
    );
    logError(error);
    process.exit(EXIT_CODES.ERROR);
  }
}

export function builder(yargs: Argv): Argv<ConfigMigrateArgs> {
  addConfigOptions(yargs);

  yargs
    .option('force', {
      alias: 'f',
      type: 'boolean',
      default: false,
      description: i18n('commands.config.subcommands.migrate.options.force'),
    })
    .example([
      [
        '$0 config migrate',
        i18n('commands.config.subcommands.migrate.examples.default', {
          deprecatedConfigPath: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
          globalConfigPath: GLOBAL_CONFIG_PATH,
        }),
      ],
      [
        '$0 config migrate --config=/path/to/config.yml',
        i18n('commands.config.subcommands.migrate.examples.configFlag', {
          globalConfigPath: GLOBAL_CONFIG_PATH,
        }),
      ],
    ]);

  return yargs as Argv<ConfigMigrateArgs>;
}
