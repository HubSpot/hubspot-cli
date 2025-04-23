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
import { trackCommandMetadataUsage } from './usageTracking';

export async function handleMigration(
  accountId: number | undefined,
  configPath?: string
): Promise<void> {
  const { shouldMigrateConfig } = await promptUser({
    name: 'shouldMigrateConfig',
    type: 'confirm',
    message: i18n('lib.configMigrate.migrateConfigPrompt', {
      deprecatedConfigPath:
        getConfigPath(configPath, false) ||
        DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      globalConfigPath: GLOBAL_CONFIG_PATH,
    }),
  });

  if (!shouldMigrateConfig) {
    trackCommandMetadataUsage(
      'config-migrate',
      {
        command: 'hs config migrate',
        type: 'migration',
        step: 'Reject migration via prompt',
      },
      accountId
    );
    return;
  }

  const deprecatedConfig = getDeprecatedConfig(configPath);
  migrateConfig(deprecatedConfig);
  trackCommandMetadataUsage(
    'config-migrate',
    {
      command: 'hs config migrate',
      type: 'migration',
      step: 'Confirm migration via prompt',
      successful: true,
    },
    accountId
  );
  logger.success(
    i18n('lib.configMigrate.migrationSuccess', {
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

  if (conflicts.length > 0) {
    for (const conflict of conflicts) {
      const { property, newValue, oldValue } = conflict;
      const { shouldOverwrite } = await promptUser({
        name: 'shouldOverwrite',
        type: 'confirm',
        message: i18n('lib.configMigrate.mergeConfigConflictPrompt', {
          property,
          oldValue: `${oldValue}`,
          newValue: `${newValue}`,
        }),
      });

      if (shouldOverwrite) {
        // @ts-expect-error Cannot reconcile CLIConfig_NEW and CLIConfig_DEPRECATED
        initialConfig[property] = oldValue;
      }
    }
  }
  return initialConfig;
}

export async function handleMerge(
  accountId: number | undefined,
  configPath?: string,
  force?: boolean
): Promise<void> {
  const { shouldMergeConfigs } = await promptUser({
    name: 'shouldMergeConfigs',
    type: 'confirm',
    message: i18n('lib.configMigrate.mergeConfigsPrompt', {
      deprecatedConfigPath:
        getConfigPath(configPath, false) ||
        DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      globalConfigPath: GLOBAL_CONFIG_PATH,
    }),
  });

  if (!shouldMergeConfigs) {
    trackCommandMetadataUsage(
      'config-migrate',
      {
        command: 'hs config migrate',
        type: 'merge',
        step: 'Reject merge via prompt',
      },
      accountId
    );
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
      i18n('lib.configMigrate.skippedExistingAccounts', {
        skippedAccountIds: skippedAccountIds.join(', '),
      })
    );
  }

  logger.success(
    i18n('lib.configMigrate.mergeSuccess', {
      globalConfigPath: GLOBAL_CONFIG_PATH,
    })
  );
  trackCommandMetadataUsage(
    'config-migrate',
    {
      command: 'hs config migrate',
      type: 'merge',
      step: 'Confirm merge via prompt',
      successful: true,
    },
    accountId
  );
  return;
}
