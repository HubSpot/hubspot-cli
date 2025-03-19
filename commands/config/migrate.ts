import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  GLOBAL_CONFIG_PATH,
} from '@hubspot/local-dev-lib/constants/config';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  configFileExists,
  getConfig,
  getConfigPath,
  migrateConfig,
  mergeExistingConfigs,
} from '@hubspot/local-dev-lib/config/migrate';

import { promptUser } from '../../lib/prompts/promptUtils';
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

async function handleMigration(
  args: ArgumentsCamelCase<ConfigMigrateArgs>,
  configPath?: string
) {
  const { shouldMigrateConfig } = await promptUser({
    name: 'shouldMigrateConfig',
    type: 'confirm',
    message: i18n(`${i18nKey}.migrateConfigPrompt`, {
      deprecatedConfigPath:
        getConfigPath(configPath, false) ||
        DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      globalConfigPath: GLOBAL_CONFIG_PATH,
    }),
  });

  if (!shouldMigrateConfig) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  const deprecatedConfig = getConfig(false);
  // @ts-ignore Cannot reconcile CLIConfig_NEW and CLIConfig_DEPRECATED
  migrateConfig(deprecatedConfig);
  logger.log(
    i18n(`${i18nKey}.migrationSuccess`, {
      globalConfigPath: GLOBAL_CONFIG_PATH,
    })
  );
  process.exit(EXIT_CODES.SUCCESS);
}

async function handleMerge(
  args: ArgumentsCamelCase<ConfigMigrateArgs>,
  configPath?: string
) {
  const { shouldMergeConfigs } = await promptUser({
    name: 'shouldMergeConfigs',
    type: 'confirm',
    message: i18n(`${i18nKey}.mergeConfigsPrompt`, {
      deprecatedConfigPath:
        getConfigPath(configPath, false) ||
        DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      globalConfigPath: GLOBAL_CONFIG_PATH,
    }),
  });

  if (!shouldMergeConfigs) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  const deprecatedConfig = getConfig(false);
  const globalConfig = getConfig(true);
  // @ts-ignore Cannot reconcile CLIConfig_NEW and CLIConfig_DEPRECATED
  mergeExistingConfigs(globalConfig, deprecatedConfig);
  logger.log(
    i18n(`${i18nKey}.mergeSuccess`, {
      globalConfigPath: GLOBAL_CONFIG_PATH,
    })
  );
  process.exit(EXIT_CODES.SUCCESS);
}

export async function handler(
  args: ArgumentsCamelCase<ConfigMigrateArgs>
): Promise<void> {
  const { config: configPath } = args;

  // If the global configuration file does not exist, migrate it
  if (!configFileExists(true)) {
    await handleMigration(args, configPath);
    // If both configuration files exist, merge them
  } else if (configFileExists(true) && configFileExists(false, configPath)) {
    await handleMerge(args, configPath);
    // If the global configuration exists and the deprecated config does not, exit.
  } else if (configFileExists(true) && !configFileExists(false, configPath)) {
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
