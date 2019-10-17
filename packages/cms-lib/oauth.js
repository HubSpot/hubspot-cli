const OAuth2Manager = require('@hubspot/api-auth-lib/OAuth2Manager');
const { updatePortalConfig } = require('./lib/config');
const { logger } = require('./logger');

const oauthManagers = new Map();

const writeOauthTokenInfo = (portalConfig, tokenInfo) => {
  const { portalId, authType, auth, env } = portalConfig;

  logger.debug(`Updating Oauth2 token info for portalId: ${portalId}`);

  updatePortalConfig({
    environment: env,
    portalId,
    authType,
    ...auth,
    tokenInfo,
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

module.exports = {
  getOauthManager,
};
