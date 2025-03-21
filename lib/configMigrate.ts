import {
  getConfig,
  getConfigPath,
  migrateConfig,
  mergeConfigProperties as _mergeConfigProperties,
  mergeExistingConfigs,
  ConflictProperty,
} from '@hubspot/local-dev-lib/config/migrate';
import {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  GLOBAL_CONFIG_PATH,
} from '@hubspot/local-dev-lib/constants/config';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  CLIConfig_NEW,
  CLIConfig_DEPRECATED,
} from '@hubspot/local-dev-lib/types/Config';

import { promptUser } from './prompts/promptUtils';
import { i18n } from './lang';

const i18nKey = 'lib.configMigrate';

export async function handleMigration(configPath?: string): Promise<void> {
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
    return;
  }

  const deprecatedConfig = getConfig(false, configPath);
  // @ts-ignore Cannot reconcile CLIConfig_NEW and CLIConfig_DEPRECATED
  migrateConfig(deprecatedConfig);
  logger.success(
    i18n(`${i18nKey}.migrationSuccess`, {
      globalConfigPath: GLOBAL_CONFIG_PATH,
    })
  );
  return;
}

async function mergeConfigProperties(
  globalConfig: CLIConfig_NEW,
  deprecatedConfig: CLIConfig_DEPRECATED
): Promise<CLIConfig_NEW> {
  const {
    initialConfig,
    conflicts,
  }: { initialConfig: CLIConfig_NEW; conflicts: ConflictProperty[] } =
    _mergeConfigProperties(globalConfig, deprecatedConfig);

  if (conflicts.length > 0) {
    for (const conflict of conflicts) {
      const { property, newValue, oldValue } = conflict;
      const { shouldOverwrite } = await promptUser({
        name: 'shouldOverwrite',
        type: 'confirm',
        message: i18n(`${i18nKey}.mergeConfigConflictPrompt`, {
          property,
          values: `${oldValue} (deprecated) vs ${newValue} (global)`,
        }),
      });

      if (shouldOverwrite) {
        // @ts-ignore Cannot reconcile CLIConfig_NEW and CLIConfig_DEPRECATED
        initialConfig[property] = oldValue;
      }
    }
  }
  return initialConfig;
}

export async function handleMerge(configPath?: string): Promise<void> {
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
    return;
  }

  const deprecatedConfig = getConfig(false, configPath);
  const globalConfig = getConfig(true);

  const mergedConfig = await mergeConfigProperties(
    // @ts-ignore Cannot reconcile CLIConfig_NEW and CLIConfig_DEPRECATED
    globalConfig,
    deprecatedConfig
  );

  const { skippedAccountIds } = mergeExistingConfigs(
    mergedConfig,
    // @ts-ignore Cannot reconcile CLIConfig_NEW and CLIConfig_DEPRECATED
    deprecatedConfig
  );

  if (skippedAccountIds.length > 0) {
    logger.log(
      i18n(`${i18nKey}.skippedExistingAccounts`, {
        skippedAccountIds: skippedAccountIds.join(', '),
      })
    );
  }

  logger.success(
    i18n(`${i18nKey}.mergeSuccess`, {
      globalConfigPath: GLOBAL_CONFIG_PATH,
    })
  );
  return;
}
