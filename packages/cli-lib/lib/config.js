const legacyConfig = require('../config/legacyConfig');
const CLIConfiguration = require('./models/CLIConfiguration');
const configFile = require('../config/configFile');

const CLIConfig = new CLIConfiguration();

// This file is used to maintain backwards compatiblity for the legacy hubspot.config.yml config.
// If the hubspot.config.yml file exists, we will fall back to legacy behavior. Otherwise we will
// use the new root config handling.

// NOTE This is gross. Everything in the code uses portalId, but that's an outdated term
// Ideally we can slowly switch to accountId, but that means we need to convert back to
// portalId while we're still supporting the legacy config.
const withPortals = config => {
  if (config) {
    const configWithPortals = { ...config };

    if (configWithPortals.defaultAccount) {
      configWithPortals.defaultPortal = configWithPortals.defaultAccount;
    }
    if (configWithPortals.accounts) {
      configWithPortals.portals = configWithPortals.accounts.map(account => {
        const { accountId, ...rest } = account;
        return { ...rest, portalId: accountId };
      });
    }
    return configWithPortals;
  }
  return config;
};

// Prioritize using the new config if it exists
const loadConfig = (path, options = {}) => {
  if (configFile.configFileExists()) {
    return CLIConfig.init(options);
  }
  return legacyConfig.loadConfig(path, options);
};

const getAndLoadConfigIfNeeded = options => {
  if (CLIConfig.active) {
    return CLIConfig.config;
  }
  return legacyConfig.getAndLoadConfigIfNeeded(options);
};

const validateConfig = () => {
  if (CLIConfig.active) {
    return CLIConfig.validate();
  }
  return legacyConfig.validateConfig();
};

const loadConfigFromEnvironment = () => {
  if (CLIConfig.active) {
    return CLIConfig.useEnvConfig;
  }
  return legacyConfig.loadConfigFromEnvironment();
};

const createEmptyConfigFile = (...args) => {
  // TODO hs init has not loaded config yet so this will never be active
  if (CLIConfig.active) {
    return CLIConfig.write({ accounts: [] });
  }
  return legacyConfig.createEmptyConfigFile(...args);
};

const deleteEmptyConfigFile = () => {
  if (CLIConfig.active) {
    return CLIConfig.delete();
  }
  return legacyConfig.deleteEmptyConfigFile();
};

const getConfig = () => {
  if (CLIConfig.active) {
    return withPortals(CLIConfig.config);
  }
  return legacyConfig.getConfig();
};

const writeConfig = (options = {}) => {
  if (CLIConfig.active) {
    const config = options.source ? JSON.parse(options.source) : undefined;
    return CLIConfig.write(config);
  }
  return legacyConfig.writeConfig(options);
};

const getConfigPath = () => {
  if (CLIConfig.active) {
    return configFile.getConfigFilePath();
  }
  return legacyConfig.getConfigPath();
};

const getAccountConfig = accountId => {
  if (CLIConfig.active) {
    return CLIConfig.getConfigForAccount(accountId);
  }
  return legacyConfig.getAccountConfig(accountId);
};

const accountNameExistsInConfig = (...args) => {
  if (CLIConfig.active) {
    return CLIConfig.isAccountNameInConfig(...args);
  }
  return legacyConfig.accountNameExistsInConfig(...args);
};

const updateAccountConfig = configOptions => {
  if (CLIConfig.active) {
    return CLIConfig.updateConfigForAccount(configOptions);
  }
  return legacyConfig.updateAccountConfig(configOptions);
};

const updateDefaultAccount = (...args) => {
  if (CLIConfig.active) {
    return CLIConfig.updateDefaultAccount(...args);
  }
  return legacyConfig.updateDefaultAccount(...args);
};

const renameAccount = async (...args) => {
  if (CLIConfig.active) {
    return CLIConfig.renameAccount(...args);
  }
  return legacyConfig.renameAccount(...args);
};

const getAccountId = nameOrId => {
  if (CLIConfig.active) {
    return CLIConfig.getAccountId(nameOrId);
  }
  return legacyConfig.getAccountId(nameOrId);
};

const removeSandboxAccountFromConfig = nameOrId => {
  if (CLIConfig.active) {
    return CLIConfig.removeAccountFromConfig(nameOrId);
  }
  return legacyConfig.removeSandboxAccountFromConfig(nameOrId);
};

const deleteAccount = accountName => {
  if (CLIConfig.active) {
    return CLIConfig.removeAccountFromConfig(accountName);
  }
  return legacyConfig.deleteAccount(accountName);
};

const updateHttpTimeout = timeout => {
  if (CLIConfig.active) {
    return CLIConfig.updateHttpTimeout(timeout);
  }
  return legacyConfig.updateHttpTimeout(timeout);
};

const updateAllowUsageTracking = isEnabled => {
  if (CLIConfig.active) {
    return CLIConfig.updateAllowUsageTracking(isEnabled);
  }
  return legacyConfig.updateAllowUsageTracking(isEnabled);
};

const deleteConfigFile = () => {
  if (CLIConfig.active) {
    return configFile.deleteConfigFile();
  }
  return legacyConfig.deleteConfigFile();
};

module.exports = {
  ...legacyConfig,
  CLIConfig,

  // Override legacy config exports
  accountNameExistsInConfig,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  getAccountConfig,
  getAccountId,
  getAndLoadConfigIfNeeded,
  getConfig,
  getConfigPath,
  deleteAccount,
  loadConfig,
  loadConfigFromEnvironment,
  removeSandboxAccountFromConfig,
  renameAccount,
  updateAccountConfig,
  updateAllowUsageTracking,
  updateDefaultAccount,
  updateHttpTimeout,
  validateConfig,
  writeConfig,
  deleteConfigFile,
};

// Keeping track of exports that require overrides
// {
//   getConfig, <DONE>
//   getConfigAccounts, <N/A>
//   getConfigDefaultAccount, <N/A>
//   getConfigAccountId, <N/A>
//   getConfigPath, <DONE>
//   getOrderedAccount, <N/A>
//   getOrderedConfig, <N/A>
//   setConfigPath, <N/A>
//   loadConfig, <DONE>
//   findConfig, <N/A>
//   loadConfigFromEnvironment, <DONE>
//   getAccountConfig, <DONE>
//   updateDefaultMode, <DONE>
//   accountNameExistsInConfig, <DONE>
//   validateConfig, <DONE>
//   renameAccount, <DONE>
//   setConfig, <N/A>
//   updateDefaultAccount, <DONE>
//   writeConfig, <DONE>
//   getAccountId, <DONE>
//   getAndLoadConfigIfNeeded, <DONE>
//   removeSandboxAccountFromConfig, <DONE>
//   createEmptyConfigFile, <DONE>
//   deleteEmptyConfigFile, <DONE>
//   updateAccountConfig, <DONE>
//   updateHttpTimeout, <DONE>
//   updateAllowUsageTracking, <DONE>
//   deleteConfigFile, <DONE>
//   deleteAccount, <DONE>
//   isConfigFlagEnabled,
//   isTrackingAllowed,
//   getEnv,
// };
