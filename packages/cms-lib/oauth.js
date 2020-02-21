const OAuth2Manager = require('@hubspot/api-auth-lib/OAuth2Manager');
const { updatePortalConfig, getPortalConfig } = require('./lib/config');
const { logger, logErrorInstance } = require('./logger');
const { OAUTH_AUTH_METHOD } = require('./lib/constants');

const oauthManagers = new Map();

const writeOauthTokenInfo = (portalConfig, tokenInfo) => {
  const { portalId, authType, auth, env, name, apiKey } = portalConfig;

  logger.debug(`Updating Oauth2 token info for portalId: ${portalId}`);

  updatePortalConfig({
    name,
    apiKey,
    env,
    portalId,
    authType,
    auth: {
      ...auth,
      tokenInfo,
    },
  });
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

const setupOauth = (portalId, portalConfig) => {
  const config = getPortalConfig(portalId) || {};
  return new OAuth2Manager(
    {
      ...portalConfig,
      env: portalConfig.env || config.env || '',
    },
    logger
  );
};

const addOauthToPortalConfig = (portalId, oauth) => {
  logger.log('Updating configuration');
  try {
    const updatedPortalConfig = updatePortalConfig({
      ...oauth.toObj(),
      authType: OAUTH_AUTH_METHOD.value,
      portalId,
    });
    logger.log('Configuration updated');
    return updatedPortalConfig;
  } catch (err) {
    logErrorInstance(err);
  }
};

const authenticateWithOauth = async configData => {
  const portalId = parseInt(configData.portalId, 10);
  const oauth = setupOauth(portalId, configData);
  logger.log('Authorizing');
  await oauth.authorize();
  return addOauthToPortalConfig(portalId, oauth);
};

module.exports = {
  getOauthManager,
  authenticateWithOauth,
};
