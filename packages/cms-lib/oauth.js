const OAuth2Manager = require('./lib/models/OAuth2Manager');
const { updatePortalConfig, writeConfig } = require('./lib/config');
const { logger, logErrorInstance } = require('./logger');
const { AUTH_METHODS } = require('./lib/constants');

const oauthManagers = new Map();

const writeOauthTokenInfo = (portalConfig, tokenInfo) => {
  const { portalId, authType, auth, env, name, apiKey } = portalConfig;

  logger.debug(`Updating Oauth2 token info for portalId: ${portalId}`);

  updatePortalConfig({
    name,
    apiKey,
    environment: env,
    portalId,
    authType,
    ...auth,
    tokenInfo,
  });
  writeConfig();
};

const getOauthManager = (portalId, portalConfig) => {
  if (!oauthManagers.has(portalId)) {
    const writeTokenInfo = tokenInfo => {
      writeOauthTokenInfo(portalConfig, tokenInfo);
    };
    oauthManagers.set(
      portalId,
      OAuth2Manager.fromConfig(portalId, portalConfig, logger, writeTokenInfo)
    );
  }
  return oauthManagers.get(portalId);
};

const addOauthToPortalConfig = (portalId, oauth) => {
  logger.log('Updating configuration');
  try {
    updatePortalConfig({
      ...oauth.toObj(),
      authType: AUTH_METHODS.oauth.value,
      portalId,
    });
    writeConfig();
    logger.log('Configuration updated');
  } catch (err) {
    logErrorInstance(err);
  }
};

module.exports = {
  getOauthManager,
  addOauthToPortalConfig,
};
