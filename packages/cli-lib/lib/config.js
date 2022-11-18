const legacyConfig = require('./config/legacyConfig');
// const CLIConfiguration = require('./models/CLIConfiguration');

// TODO two options for how to handle this roll out
// 1. Major breaking change - delete legacy config file and force usage of the new config file
//    - This would require us to force users to move their config files to root, otherwise this won't work
// 2. Use this file as a proxy. If user has a root config, use the CLIConfiguration class. If not, fall back to current behavior.

module.exports = legacyConfig;
// {
//   getAndLoadConfigIfNeeded,
//   getEnv,
//   getConfig,
//   getConfigAccounts,
//   getConfigDefaultAccount,
//   getConfigAccountId,
//   getConfigPath,
//   getOrderedAccount,
//   getOrderedConfig,
//   isConfigFlagEnabled,
//   setConfig,
//   setConfigPath,
//   loadConfig,
//   findConfig,
//   loadConfigFromEnvironment,
//   getAccountConfig,
//   getAccountId,
//   removeSandboxAccountFromConfig,
//   updateAccountConfig,
//   updateDefaultAccount,
//   updateDefaultMode,
//   updateHttpTimeout,
//   updateAllowUsageTracking,
//   renameAccount,
//   createEmptyConfigFile,
//   deleteEmptyConfigFile,
//   isTrackingAllowed,
//   validateConfig,
//   writeConfig,
//   accountNameExistsInConfig,
// };
