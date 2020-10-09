const OAuth2Manager = require('./lib/models/OAuth2Manager');
const { updateAccountConfig, writeConfig } = require('./lib/config');
const { logger, logErrorInstance } = require('./logger');
const { AUTH_METHODS } = require('./lib/constants');

const oauthManagers = new Map();

const writeOauthTokenInfo = (AccountConfig, tokenInfo) => {
  const { accountId, authType, auth, env, name, apiKey } = AccountConfig;

  logger.debug(`Updating Oauth2 token info for accountId: ${accountId}`);

  updateAccountConfig({
    name,
    apiKey,
    environment: env,
    accountId,
    authType,
    ...auth,
    tokenInfo,
  });
  writeConfig();
};

const getOauthManager = (accountId, AccountConfig) => {
  if (!oauthManagers.has(accountId)) {
    const writeTokenInfo = tokenInfo => {
      writeOauthTokenInfo(AccountConfig, tokenInfo);
    };
    oauthManagers.set(
      accountId,
      OAuth2Manager.fromConfig(accountId, AccountConfig, logger, writeTokenInfo)
    );
  }
  return oauthManagers.get(accountId);
};

const addOauthToAccountConfig = (accountId, oauth) => {
  logger.log('Updating configuration');
  try {
    updateAccountConfig({
      ...oauth.toObj(),
      authType: AUTH_METHODS.oauth.value,
      accountId,
    });
    writeConfig();
    logger.log('Configuration updated');
  } catch (err) {
    logErrorInstance(err);
  }
};

module.exports = {
  getOauthManager,
  addOauthToAccountConfig,
};
