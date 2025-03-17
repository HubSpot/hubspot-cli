import {
  CLIConfig,
  CLIConfig_DEPRECATED,
  CLIConfig_NEW,
  Environment,
} from '@hubspot/local-dev-lib/types/Config';
import {
  writeConfig,
  createEmptyConfigFile,
  loadConfig,
  deleteEmptyConfigFile,
  deleteConfigFile,
} from '@hubspot/local-dev-lib/config';
import { logError } from './errorHandlers';
import { logger } from '@hubspot/local-dev-lib/logger';
import { EXIT_CODES } from './enums/exitCodes';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';

function writeGlobalConfigFile(updatedConfig: CLIConfig_NEW): void {
  const updatedConfigJson = JSON.stringify(updatedConfig);
  createEmptyConfigFile({}, true);
  loadConfig('');

  try {
    writeConfig({ source: updatedConfigJson });
    deleteConfigFile(true);
  } catch (error) {
    deleteEmptyConfigFile();

    logError(error);
    process.exit(EXIT_CODES.ERROR);
  }
}

export function migrateConfig(deprecatedConfig: CLIConfig_DEPRECATED): void {
  const { defaultPortal, portals, ...rest } = deprecatedConfig;
  const updatedConfig = {
    ...rest,
    defaultAccount: defaultPortal,
    accounts: portals
      .filter(({ portalId }) => portalId !== undefined)
      .map(({ portalId, ...rest }) => ({
        ...rest,
        accountId: portalId!,
      })),
  };
  writeGlobalConfigFile(updatedConfig);
}

function mergeConfigPropertes(
  globalConfig: CLIConfig_NEW,
  deprecatedConfig: CLIConfig_DEPRECATED
): CLIConfig_NEW {
  const propertiesToCheck: Array<keyof Partial<CLIConfig>> = [
    'defaultCmsPublishMode',
    'httpTimeout',
    'allowUsageTracking',
    'env',
  ];
  const conflicts: Array<{
    property: keyof CLIConfig;
    oldValue: boolean | string | number | CmsPublishMode | Environment;
    newValue: boolean | string | number | CmsPublishMode | Environment;
  }> = [];

  propertiesToCheck.forEach(prop => {
    if (prop in globalConfig) {
      if (
        globalConfig[prop] &&
        deprecatedConfig[prop] &&
        globalConfig[prop] !== deprecatedConfig[prop]
      ) {
        conflicts.push({
          property: prop,
          oldValue: deprecatedConfig[prop],
          newValue: globalConfig[prop],
        });
      }
    } else {
      // @ts-ignore TODO
      globalConfig[prop] = deprecatedConfig[prop];
    }
  });

  if (conflicts.length > 0) {
    logger.log(
      `The following properties have different values in the deprecated and global config files:\n${conflicts
        .map(
          ({ property, oldValue, newValue }) =>
            `${property}: ${oldValue} (deprecated) vs ${newValue} (global)`
        )
        .join('\n')}`
    );
    return globalConfig;
  }

  return globalConfig;
}

function mergeAccounts(
  globalConfig: CLIConfig_NEW,
  deprecatedConfig: CLIConfig_DEPRECATED
): CLIConfig_NEW {
  if (globalConfig.accounts && deprecatedConfig.portals) {
    const existingPortalIds = new Set(
      globalConfig.accounts.map(account => account.accountId)
    );

    const newAccounts = deprecatedConfig.portals
      .filter(portal => !existingPortalIds.has(portal.portalId!))
      .map(({ portalId, ...rest }) => ({
        ...rest,
        accountId: portalId!,
      }));

    if (newAccounts.length > 0) {
      globalConfig.accounts.push(...newAccounts);
    }
  }

  return globalConfig;
}

export function mergeExistingConfigs(
  globalConfig: CLIConfig_NEW,
  deprecatedConfig: CLIConfig_DEPRECATED
): void {
  const updatedConfig = mergeConfigPropertes(globalConfig, deprecatedConfig);
  const finalConfig = mergeAccounts(updatedConfig, deprecatedConfig);

  writeGlobalConfigFile(finalConfig);
}
