import {
  getDeprecatedConfig,
  getGlobalConfig,
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

  const deprecatedConfig = getDeprecatedConfig(configPath);
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
  deprecatedConfig: CLIConfig_DEPRECATED,
  force?: boolean
): Promise<CLIConfig_NEW> {
  const {
    initialConfig,
    conflicts,
  }: { initialConfig: CLIConfig_NEW; conflicts: ConflictProperty[] } =
    _mergeConfigProperties(globalConfig, deprecatedConfig, force);

  if (conflicts.length > 0 && !force) {
    for (const conflict of conflicts) {
      const { property, newValue, oldValue } = conflict;
      const { shouldOverwrite } = await promptUser({
        name: 'shouldOverwrite',
        type: 'confirm',
        message: i18n(`${i18nKey}.mergeConfigConflictPrompt`, {
          property,
          oldValue: `${oldValue}`,
          newValue: `${newValue}`,
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

export async function handleMerge(
  configPath?: string,
  force?: boolean
): Promise<void> {
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

  const deprecatedConfig = getDeprecatedConfig(configPath);
  const globalConfig = getGlobalConfig();

  if (!deprecatedConfig || !globalConfig) {
    return;
  }

  const mergedConfig = await mergeConfigProperties(
    globalConfig,
    deprecatedConfig,
    force
  );

  const { skippedAccountIds } = mergeExistingConfigs(
    mergedConfig,
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
