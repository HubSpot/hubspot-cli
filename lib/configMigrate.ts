import {
  getConfig,
  getConfigPath,
  migrateConfig,
  mergeExistingConfigs,
} from '@hubspot/local-dev-lib/config/migrate';
import {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  GLOBAL_CONFIG_PATH,
} from '@hubspot/local-dev-lib/constants/config';
import { logger } from '@hubspot/local-dev-lib/logger';

import { promptUser } from './prompts/promptUtils';
import { i18n } from './lang';
import { EXIT_CODES } from './enums/exitCodes';

const i18nKey = 'lib.configMigrate';

export async function handleMigration(configPath?: string) {
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

export async function handleMerge(configPath?: string) {
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
