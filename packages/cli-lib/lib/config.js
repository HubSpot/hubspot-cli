const { logger } = require('../logger');

let _config;

const getConfig = () => _config;

const setConfig = updatedConfig => {
  _config = updatedConfig;
  return _config;
};

const getConfigAccounts = config => {
  const __config = config || getConfig();
  if (!__config) return;
  return __config.portals;
};

const getConfigDefaultAccount = config => {
  const __config = config || getConfig();
  if (!__config) return;
  return __config.defaultPortal;
};

const getConfigAccountId = config => {
  const __config = config || getConfig();
  if (!__config) return;
  return __config.portalId;
};

/**
 * @returns {boolean}
 */
const validateConfig = () => {
  const config = getConfig();
  if (!config) {
    logger.error('No config was found');
    return false;
  }
  const accounts = getConfigAccounts();
  if (!Array.isArray(accounts)) {
    logger.error('config.portals[] is not defined');
    return false;
  }
  const accountIdsHash = {};
  const accountNamesHash = {};
  return accounts.every(cfg => {
    if (!cfg) {
      logger.error('config.portals[] has an empty entry');
      return false;
    }

    const accountId = getConfigAccountId(cfg);
    if (!accountId) {
      logger.error('config.portals[] has an entry missing portalId');
      return false;
    }
    if (accountIdsHash[accountId]) {
      logger.error(
        `config.portals[] has multiple entries with portalId=${accountId}`
      );
      return false;
    }

    if (cfg.name) {
      if (accountNamesHash[cfg.name]) {
        logger.error(
          `config.name has multiple entries with portalId=${accountId}`
        );
        return false;
      }
      if (/\s+/.test(cfg.name)) {
        logger.error(`config.name '${cfg.name}' cannot contain spaces`);
        return false;
      }
      accountNamesHash[cfg.name] = cfg;
    }

    accountIdsHash[accountId] = cfg;
    return true;
  });
};

const accountNameExistsInConfig = name => {
  const config = getConfig();
  const accounts = getConfigAccounts();

  if (!config || !Array.isArray(accounts)) {
    return false;
  }

  return accounts.some(cfg => cfg.name && cfg.name === name);
};

const getOrderedAccount = unorderedAccount => {
  const { name, portalId, env, authType, ...rest } = unorderedAccount;

  return {
    name,
    ...(portalId && { portalId }),
    env,
    authType,
    ...rest,
  };
};

module.exports = {
  getConfig,
  getConfigAccounts,
  getConfigDefaultAccount,
  getConfigAccountId,
  getOrderedAccount,
  setConfig,
  validateConfig,
  accountNameExistsInConfig,
};
