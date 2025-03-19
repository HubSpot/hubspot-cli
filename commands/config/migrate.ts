import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  GLOBAL_CONFIG_PATH,
} from '@hubspot/local-dev-lib/constants/config';
import { logger } from '@hubspot/local-dev-lib/logger';
import { configFileExists } from '@hubspot/local-dev-lib/config/migrate';

import { handleMigration, handleMerge } from '../../lib/configMigrate';
import { addConfigOptions } from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';
import { EXIT_CODES } from '../../lib/enums/exitCodes';

const i18nKey = 'commands.config.subcommands.migrate';

export const describe = i18n(`${i18nKey}.describe`, {
  deprecatedConfigPath: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  globalConfigPath: GLOBAL_CONFIG_PATH,
});
export const command = 'migrate';

type ConfigMigrateArgs = CommonArgs & ConfigArgs;

export async function handler(
  args: ArgumentsCamelCase<ConfigMigrateArgs>
): Promise<void> {
  const { config: configPath } = args;

  const deprecatedConfigExists = configFileExists(false, configPath);
  const globalConfigExists = configFileExists(true);

  if (!globalConfigExists && deprecatedConfigExists) {
    await handleMigration(configPath);
  } else if (globalConfigExists && deprecatedConfigExists) {
    await handleMerge(configPath);
  } else if (globalConfigExists && !deprecatedConfigExists) {
    logger.log(
      i18n(`${i18nKey}.migrationAlreadyCompleted`, {
        globalConfigPath: GLOBAL_CONFIG_PATH,
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}

export function builder(yargs: Argv): Argv<ConfigMigrateArgs> {
  addConfigOptions(yargs);

  yargs.example([
    [
      '$0 config migrate',
      i18n(`${i18nKey}.examples.default`, {
        deprecatedConfigPath: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
        globalConfigPath: GLOBAL_CONFIG_PATH,
      }),
    ],
    [
      '$0 config migrate --config=/path/to/config.yml',
      i18n(`${i18nKey}.examples.configFlag`, {
        globalConfigPath: GLOBAL_CONFIG_PATH,
      }),
    ],
  ]);

  return yargs as Argv<ConfigMigrateArgs>;
}
