const { logger } = require('../../logger');
const {
  getValidEnv,
  loadConfigFromEnvironment,
} = require('../config/environment');
const {
  loadConfigFromFile,
  writeConfigToFile,
  configFileExists,
  configFileIsBlank,
  deleteConfigFile,
} = require('../config/configFile');
const { commaSeparatedValues } = require('../text');
const { Mode, MIN_HTTP_TIMEOUT } = require('../constants');

class CLIConfiguration {
  constructor(options) {
    this.options = options;
    this.useEnvConfig = false;
    this.config = null;
  }

  load() {
    if (this.options.useEnv) {
      const configFromEnv = loadConfigFromEnvironment();
      if (configFromEnv) {
        logger.debug(
          `Loaded config from environment variables for ${configFromEnv.accountId}`
        );
        this.useEnvConfig = true;
        this.config = configFromEnv;
      }
    } else {
      const configFromFile = loadConfigFromFile(this.options);
      logger.debug('Loaded config from configuration file.');
      if (!configFromFile) {
        logger.debug(
          'The config file was empty. Initializing an empty config.'
        );
        this.config = { accounts: [] };
      }
      this.useEnvConfig = false;
      this.config = configFromFile;
    }

    return this.config;
  }

  delete() {
    if (!this.useEnvConfig && configFileExists() && configFileIsBlank()) {
      deleteConfigFile();
      this.config = null;
    }
  }

  write(updatedConfig) {
    if (!this.useEnvConfig) {
      if (updatedConfig) {
        this.config = updatedConfig;
      }
      writeConfigToFile(this.config);
    }
    return this.config;
  }

  validate() {
    if (!this.config) {
      logger.error('Valiation failed: No config was found.');
      return false;
    }
    if (!Array.isArray(this.config.accounts)) {
      logger.error('Valiation failed: config.accounts[] is not defined.');
      return false;
    }

    const accountIdsMap = {};
    const accountNamesMap = {};
    return this.config.accounts.every(accountConfig => {
      if (!accountConfig) {
        logger.error('Valiation failed: config.accounts[] has an empty entry');
        return false;
      }
      if (!accountConfig.accountId) {
        logger.error(
          'Valiation failed: config.accounts[] has an entry missing accountId'
        );
        return false;
      }
      if (accountIdsMap[accountConfig.accountId]) {
        logger.error(
          `Valiation failed: config.accounts[] has multiple entries with accountId=${accountConfig.accountId}`
        );
        return false;
      }
      if (accountConfig.name) {
        if (accountNamesMap[accountConfig.name]) {
          logger.error(
            `Valiation failed: config.accounts[] has multiple entries with name=${accountConfig.name}`
          );
          return false;
        }
        if (/\s+/.test(accountConfig.name)) {
          logger.error(
            `Valiation failed: config.name '${accountConfig.name}' cannot contain spaces`
          );
          return false;
        }
        accountNamesMap[accountConfig.name] = true;
      }

      accountIdsMap[accountConfig.accountId] = true;
      return true;
    });
  }

  /*
   * Config Lookup Utils
   */

  getAccountId(nameOrId) {
    let name;
    let accountId;

    if (!this.config) {
      return null;
    }

    const setNameOrAccount = suppliedValue => {
      if (typeof suppliedValue === 'number') {
        accountId = suppliedValue;
      } else if (/^\d+$/.test(suppliedValue)) {
        accountId = parseInt(suppliedValue, 10);
      } else {
        name = suppliedValue;
      }
    };

    if (!nameOrId) {
      if (this.config.defaultAccount) {
        setNameOrAccount(this.config.defaultAccount);
      }
    } else {
      setNameOrAccount(nameOrId);
    }

    if (name) {
      return this.config.accounts.find(a => a.name === name);
    } else if (accountId) {
      return this.config.accounts.find(a => accountId === a.accountId);
    }

    return null;
  }

  getConfigAccountIndex(accountId) {
    return this.config
      ? this.config.accounts.findIndex(
          account => account.accountId === accountId
        )
      : -1;
  }

  getConfigForAccount(accountId) {
    return this.config
      ? this.config.accounts.find(account => account.accountId === accountId)
      : null;
  }

  /*
   * Config Update Utils
   */

  /**
   * @throws {Error}
   */
  updateConfigForAccount(updatedConfig, writeUpdate = true) {
    const {
      accountId,
      authType,
      environment,
      clientId,
      clientSecret,
      scopes,
      tokenInfo,
      defaultMode,
      name,
      apiKey,
      personalAccessKey,
      sandboxAccountType,
      parentAccountId,
    } = updatedConfig;

    if (!accountId) {
      throw new Error('An accountId is required to update the config');
    }
    if (!this.config) {
      logger.debug('No config to update.');
      return;
    }

    const currentAccountConfig = this.getConfigForAccount(accountId);

    let auth;
    if (clientId || clientSecret || scopes || tokenInfo) {
      auth = {
        ...(currentAccountConfig ? currentAccountConfig.auth : {}),
        clientId,
        clientSecret,
        scopes,
        tokenInfo,
      };
    }

    const env = getValidEnv(
      environment || (currentAccountConfig && currentAccountConfig.env),
      {
        maskedProductionValue: undefined,
      }
    );
    const newDefaultMode = defaultMode && defaultMode.toLowerCase();
    const nextAccountConfig = {
      ...(currentAccountConfig ? currentAccountConfig : {}),
      name:
        name || (currentAccountConfig ? currentAccountConfig.name : undefined),
      env,
      accountId,
      authType,
      auth,
      apiKey,
      defaultMode: Mode[newDefaultMode] ? newDefaultMode : undefined,
      personalAccessKey,
      sandboxAccountType,
      parentAccountId,
    };

    if (currentAccountConfig) {
      logger.debug(`Updating account config for ${accountId}`);
      const index = this.getConfigAccountIndex(accountId);
      this.config.accounts[index] = nextAccountConfig;
    } else {
      logger.debug(`Adding account config entry for ${accountId}`);
      if (this.config.accounts) {
        this.config.accounts.push(nextAccountConfig);
      } else {
        this.config.accounts = [nextAccountConfig];
      }
    }

    if (writeUpdate) {
      this.writeConfig();
    }

    return nextAccountConfig;
  }

  /**
   * @throws {Error}
   */
  updateDefaultAccount(defaultAccount) {
    if (!this.config) {
      throw new Error('No Config loaded.');
    }
    if (
      !defaultAccount ||
      (typeof defaultAccount !== 'number' && typeof defaultAccount !== 'string')
    ) {
      throw new Error(
        `A 'defaultAccount' with value of number or string is required to update the config.`
      );
    }

    this.config.defaultAccount = defaultAccount;
    this.writeConfig();
  }

  /**
   * @throws {Error}
   */
  renameAccount(currentName, newName) {
    if (!this.config) {
      throw new Error('No Config loaded.');
    }
    const accountId = this.getAccountId(currentName);
    const accountConfigToRename = this.getConfigForAccount(accountId);

    if (!accountConfigToRename) {
      throw new Error(`Cannot find account with identifier ${currentName}`);
    }

    this.updateConfigForAccount({
      accountId,
      name: newName,
    });

    if (accountConfigToRename.name === this.config.defaultAccount) {
      this.updateDefaultAccount(newName);
    }
  }

  /**
   * @throws {Error}
   */
  removeAccountFromConfig(nameOrId) {
    if (!this.config) {
      throw new Error('No Config loaded.');
    }
    const accountId = this.getAccountId(nameOrId);

    if (!accountId) {
      throw new Error(`Unable to find account for ${nameOrId}.`);
    }

    let shouldShowDefaultAccountPrompt;
    const accountConfig = this.getConfigForAccount(accountId);

    if (accountConfig) {
      logger.debug(`Deleting config for ${accountId}`);
      const index = this.getConfigAccountIndex(accountId);
      this.config.accounts.splice(index, 1);

      if (this.config.defaultAccount === accountConfig.name) {
        shouldShowDefaultAccountPrompt = true;
      }

      this.writeConfig();
    }

    return shouldShowDefaultAccountPrompt;
  }

  /**
   * @throws {Error}
   */
  updateDefaultMode(defaultMode) {
    if (!this.config) {
      throw new Error('No Config loaded.');
    }
    const ALL_MODES = Object.values(Mode);
    if (!defaultMode || !ALL_MODES.find(m => m === defaultMode)) {
      throw new Error(
        `The mode ${defaultMode} is invalid. Valid values are ${commaSeparatedValues(
          ALL_MODES
        )}.`
      );
    }

    this.config.defaultMode = defaultMode;
    this.writeConfig();
  }

  /**
   * @throws {Error}
   */
  updateHttpTimeout(timeout) {
    if (!this.config) {
      throw new Error('No Config loaded.');
    }
    const parsedTimeout = parseInt(timeout);
    if (isNaN(parsedTimeout) || parsedTimeout < MIN_HTTP_TIMEOUT) {
      throw new Error(
        `The value ${timeout} is invalid. The value must be a number greater than ${MIN_HTTP_TIMEOUT}.`
      );
    }

    this.config.httpTimeout = parsedTimeout;
    this.writeConfig();
  }

  /**
   * @throws {Error}
   */
  updateAllowUsageTracking(isEnabled) {
    if (!this.config) {
      throw new Error('No Config loaded.');
    }
    if (typeof isEnabled !== 'boolean') {
      throw new Error(
        `Unable to update allowUsageTracking. The value ${isEnabled} is invalid. The value must be a boolean.`
      );
    }

    this.config.allowUsageTracking = isEnabled;
    this.writeConfig();
  }
}

module.exports = CLIConfiguration;
