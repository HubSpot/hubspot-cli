import {
  getConfigAtPath,
  migrateConfigAtPath,
  mergeConfigProperties,
  mergeConfigAccounts,
  ConflictProperty,
  archiveConfigAtPath,
} from '@hubspot/local-dev-lib/config/migrate';
import { ARCHIVED_HUBSPOT_CONFIG_YAML_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import {
  HubSpotConfig,
  DeprecatedHubSpotConfigFields,
} from '@hubspot/local-dev-lib/types/Config';
import { promptUser } from './prompts/promptUtils.js';
import { lib } from '../lang/en.js';
import { uiLogger } from './ui/logger.js';
import {
  HubSpotConfigAccount,
  DeprecatedHubSpotConfigAccountFields,
} from '@hubspot/local-dev-lib/types/Accounts';
import {
  getConfig,
  getLocalConfigFilePathIfExists,
} from '@hubspot/local-dev-lib/config';
import { debugError } from './errorHandlers/index.js';

type DeprecatedHubspotConfig = HubSpotConfig & DeprecatedHubSpotConfigFields;
type DeprecatedHubspotConfigAccount = HubSpotConfigAccount &
  DeprecatedHubSpotConfigAccountFields;

async function promptRenameOrOmitAccount(
  accountName: string,
  accountId: number
): Promise<boolean> {
  const { shouldRename } = await promptUser<{
    shouldRename: boolean;
  }>({
    name: 'shouldRename',
    type: 'confirm',
    message:
      lib.configMigrate.handleAccountNameConflicts.prompts.renameOrOmitAccountPrompt(
        accountName,
        accountId
      ),
  });

  return shouldRename;
}

async function promptNewAccountName(
  account: DeprecatedHubspotConfigAccount,
  globalConfig: HubSpotConfig,
  renamedAccounts: Array<DeprecatedHubspotConfigAccount>
): Promise<string> {
  const { newAccountName } = await promptUser<{
    newAccountName: string;
  }>({
    name: 'newAccountName',
    type: 'input',
    default: `${account.name}_${account.portalId}`,
    message:
      lib.configMigrate.handleAccountNameConflicts.prompts.newAccountNamePrompt(
        account.name,
        account.portalId!
      ),
    validate: value => {
      if (!value) {
        return lib.configMigrate.handleAccountNameConflicts.errors.nameRequired;
      }
      if (value === account.name) {
        return lib.configMigrate.handleAccountNameConflicts.errors.sameName;
      }

      const existingAccount = globalConfig.accounts.some(
        (acc: HubSpotConfigAccount) => acc.name === value
      );
      const renamedAccount = renamedAccounts.some(acc => acc.name === value);

      if (existingAccount || renamedAccount) {
        return lib.configMigrate.handleAccountNameConflicts.errors.nameAlreadyInConfig(
          value
        );
      }

      return true;
    },
  });

  return newAccountName;
}

export async function handleMigration(hideWarning?: boolean): Promise<boolean> {
  const deprecatedConfigPath =
    process.env.HUBSPOT_CONFIG_PATH || getLocalConfigFilePathIfExists()!;

  if (!hideWarning) {
    uiLogger.warn(
      lib.configMigrate.deprecatedConfigWarning(deprecatedConfigPath || '')
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

  migrateConfigAtPath(deprecatedConfigPath || '');

  try {
    archiveConfigAtPath(deprecatedConfigPath);
  } catch (error) {
    debugError(error);
    uiLogger.error(lib.configMigrate.errors.archive(deprecatedConfigPath));
    return true;
  }

  uiLogger.success(lib.configMigrate.handleMigration.success);

  return true;
}

async function handleMergeConfigProperties(
  globalConfig: HubSpotConfig,
  deprecatedConfig: DeprecatedHubspotConfig,
  force?: boolean
): Promise<HubSpotConfig> {
  const {
    configWithMergedProperties,
    conflicts,
  }: {
    configWithMergedProperties: HubSpotConfig;
    conflicts: ConflictProperty[];
  } = mergeConfigProperties(globalConfig, deprecatedConfig, force);

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
      const { shouldOverwrite } = await promptUser<{
        shouldOverwrite: boolean;
      }>({
        name: 'shouldOverwrite',
        type: 'confirm',
        message:
          lib.configMigrate.handleMergeConfigProperties.mergeConfigConflictPrompt(
            property,
            newValue.toString(),
            oldValue?.toString() || ''
          ),
      });

      if (shouldOverwrite) {
        // @ts-expect-error Cannot reconcile CLIConfig_NEW and CLIConfig_DEPRECATED
        configWithMergedProperties[property] = oldValue;
      }
    }
  }
  return configWithMergedProperties;
}

async function handleAccountNameConflicts(
  globalConfig: HubSpotConfig,
  deprecatedConfig: DeprecatedHubspotConfig,
  force?: boolean
): Promise<DeprecatedHubspotConfig> {
  if (!deprecatedConfig.portals?.length || !globalConfig.accounts?.length) {
    return deprecatedConfig;
  }

  const accountsWithConflictsToRemove = new Set<
    HubSpotConfigAccount & DeprecatedHubSpotConfigAccountFields
  >();
  const renamedAccounts: Array<
    HubSpotConfigAccount & DeprecatedHubSpotConfigAccountFields
  > = [];

  const accountsNotYetInGlobal = (deprecatedConfig.portals || []).filter(
    portal =>
      portal.portalId &&
      !globalConfig.accounts?.some(acc => acc.accountId === portal.portalId)
  );

  const accountsWithConflicts = accountsNotYetInGlobal.filter(localAccount =>
    globalConfig.accounts?.some(
      globalAccount => globalAccount.name === localAccount.name
    )
  );

  if (accountsWithConflicts.length > 0) {
    uiLogger.log('');
    uiLogger.warn(
      lib.configMigrate.handleAccountNameConflicts.warnings.accountNameConflictMessage(
        accountsWithConflicts.length
      )
    );

    if (force) {
      const renameDetails: string[] = [];
      for (const account of accountsWithConflicts) {
        accountsWithConflictsToRemove.add(account);
        const newAccountName = `${account.name}_${account.portalId}`;
        renamedAccounts.push({
          ...account,
          name: newAccountName,
        });
        renameDetails.push(
          `  "${account.name}" → "${newAccountName}" (ID: ${account.portalId})`
        );
      }
      uiLogger.warn(
        lib.configMigrate.handleAccountNameConflicts.warnings.forceFlagDetected(
          accountsWithConflicts.length,
          renameDetails.join('\n')
        )
      );
      uiLogger.log('');
    } else {
      for (const account of accountsWithConflicts) {
        uiLogger.log('');
        const shouldRename = await promptRenameOrOmitAccount(
          account.name!,
          account.portalId!
        );

        accountsWithConflictsToRemove.add(account);
        if (shouldRename) {
          const newAccountName = await promptNewAccountName(
            account,
            globalConfig,
            renamedAccounts
          );

          renamedAccounts.push({
            ...account,
            name: newAccountName,
          });
        }
      }
    }

    deprecatedConfig.portals.push(...renamedAccounts);
  }

  const cleanedPortals: Array<DeprecatedHubspotConfigAccount> = (
    deprecatedConfig.portals || []
  ).filter(portal => !accountsWithConflictsToRemove.has(portal));

  return { ...deprecatedConfig, portals: cleanedPortals };
}

export async function handleMerge(
  force?: boolean,
  hideWarning?: boolean
): Promise<boolean> {
  const deprecatedConfigPath =
    process.env.HUBSPOT_CONFIG_PATH || getLocalConfigFilePathIfExists()!;

  if (!hideWarning) {
    uiLogger.warn(
      lib.configMigrate.deprecatedConfigWarning(deprecatedConfigPath || '')
    );
    uiLogger.log('');
  }
  uiLogger.log(
    lib.configMigrate.handleMerge.description(
      ARCHIVED_HUBSPOT_CONFIG_YAML_FILE_NAME
    )
  );

  if (!force) {
    uiLogger.log('');
    const { shouldMergeConfigs } = await promptUser<{
      shouldMergeConfigs: boolean;
    }>({
      name: 'shouldMergeConfigs',
      type: 'confirm',
      message: lib.configMigrate.handleMerge.confirmPrompt,
    });

    if (shouldMergeConfigs === false) {
      return true; // exit with "true" so the user is shown a success message instead of an error
    }
  }

  let deprecatedConfig: DeprecatedHubspotConfig;
  let globalConfig: HubSpotConfig;

  try {
    deprecatedConfig = getConfigAtPath(deprecatedConfigPath || '');
    globalConfig = getConfig();
  } catch (error) {
    debugError(error);
    return true;
  }

  const mergedConfig = await handleMergeConfigProperties(
    globalConfig,
    deprecatedConfig,
    force
  );

  const cleanedDeprecatedConfig = await handleAccountNameConflicts(
    mergedConfig,
    deprecatedConfig,
    force
  );

  const { skippedAccountIds } = mergeConfigAccounts(
    mergedConfig,
    cleanedDeprecatedConfig
  );

  if (skippedAccountIds.length > 0) {
    uiLogger.log('');
    uiLogger.log(
      lib.configMigrate.handleMerge.skippedExistingAccounts(skippedAccountIds)
    );
    uiLogger.log('');
  }

  try {
    archiveConfigAtPath(deprecatedConfigPath);
  } catch (error) {
    debugError(error);
    uiLogger.error(lib.configMigrate.errors.archive(deprecatedConfigPath));
    return true;
  }

  uiLogger.success(lib.configMigrate.handleMerge.success);
  return true;
}
