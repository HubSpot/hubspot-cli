import {
  getDeprecatedConfig,
  getGlobalConfig,
  getConfigPath,
  migrateConfig,
  mergeConfigProperties,
  mergeExistingConfigs,
  ConflictProperty,
} from '@hubspot/local-dev-lib/config/migrate';
import { ARCHIVED_HUBSPOT_CONFIG_YAML_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import {
  CLIConfig_NEW,
  CLIConfig_DEPRECATED,
} from '@hubspot/local-dev-lib/types/Config';
import { promptUser } from './prompts/promptUtils.js';
import { lib } from '../lang/en.js';
import { uiLogger } from './ui/logger.js';

export async function handleMigration(
  deprecatedConfigPath?: string,
  hideWarning?: boolean
): Promise<boolean> {
  if (!hideWarning) {
    uiLogger.warn(
      lib.configMigrate.deprecatedConfigWarning(
        deprecatedConfigPath || getConfigPath(undefined, false)!
      )
    );
    uiLogger.log('');
  }
  uiLogger.log(
    lib.configMigrate.handleMigration.description(
      ARCHIVED_HUBSPOT_CONFIG_YAML_FILE_NAME
    )
  );
  uiLogger.log('');

  const { shouldMigrateConfig } = await promptUser({
    name: 'shouldMigrateConfig',
    type: 'confirm',
    message: lib.configMigrate.handleMigration.confirmPrompt,
  });

  if (!shouldMigrateConfig) {
    return false;
  }

  const deprecatedConfig = getDeprecatedConfig(deprecatedConfigPath);
  migrateConfig(deprecatedConfig);

  uiLogger.success(lib.configMigrate.handleMigration.success);

  return true;
}

async function handleMergeConfigProperties(
  globalConfig: CLIConfig_NEW,
  deprecatedConfig: CLIConfig_DEPRECATED,
  force?: boolean
): Promise<CLIConfig_NEW> {
  const {
    initialConfig,
    conflicts,
  }: { initialConfig: CLIConfig_NEW; conflicts: ConflictProperty[] } =
    mergeConfigProperties(globalConfig, deprecatedConfig, force);

  if (conflicts.length > 0) {
    const properties = conflicts.map(c => c.property);
    const propertyList =
      properties.length <= 2
        ? properties.join(' and ')
        : `${properties.slice(0, -1).join(', ')}, and ${properties.at(-1)}`;

    uiLogger.log('');
    uiLogger.warn(
      lib.configMigrate.handleMergeConfigProperties.mergeConflictMessage(
        conflicts.length,
        propertyList
      )
    );
    for (const conflict of conflicts) {
      const { property, newValue, oldValue } = conflict;
      const { shouldOverwrite } = await promptUser({
        name: 'shouldOverwrite',
        type: 'confirm',
        message:
          lib.configMigrate.handleMergeConfigProperties.mergeConfigConflictPrompt(
            property,
            newValue.toString(),
            oldValue.toString()
          ),
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
  deprecatedConfigPath?: string,
  force?: boolean,
  hideWarning?: boolean
): Promise<boolean> {
  if (!hideWarning) {
    uiLogger.warn(
      lib.configMigrate.deprecatedConfigWarning(
        deprecatedConfigPath || getConfigPath(undefined, false)!
      )
    );
    uiLogger.log('');
  }
  uiLogger.log(
    lib.configMigrate.handleMerge.description(
      ARCHIVED_HUBSPOT_CONFIG_YAML_FILE_NAME
    )
  );
  uiLogger.log('');

  const { shouldMergeConfigs } = await promptUser({
    name: 'shouldMergeConfigs',
    type: 'confirm',
    message: lib.configMigrate.handleMerge.confirmPrompt,
  });

  if (!shouldMergeConfigs) {
    return false;
  }

  const deprecatedConfig = getDeprecatedConfig(deprecatedConfigPath);
  const globalConfig = getGlobalConfig();

  if (!deprecatedConfig || !globalConfig) {
    return true;
  }

  const mergedConfig = await handleMergeConfigProperties(
    globalConfig,
    deprecatedConfig,
    force
  );

  const { skippedAccountIds } = mergeExistingConfigs(
    mergedConfig,
    deprecatedConfig
  );

  if (skippedAccountIds.length > 0) {
    uiLogger.log('');
    uiLogger.log(
      lib.configMigrate.handleMerge.skippedExistingAccounts(skippedAccountIds)
    );
    uiLogger.log('');
  }

  uiLogger.success(lib.configMigrate.handleMerge.success);
  return true;
}
