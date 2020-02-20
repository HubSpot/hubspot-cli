const { OAUTH_AUTH_METHOD } = require('../constants');

/**
 * Generates a portalConfig object from previous values and desired updates
 * @param {object} portalConfig Existing oauth2 portalConfig
 * @param {object} configUpdates Object containing desired updates
 */
const getUpdatedOauthPortalConfig = (portalConfig = {}, configUpdates = {}) => {
  const auth = {
    ...portalConfig.auth,
    ...configUpdates.auth,
  };

  if (!auth) {
    throw new Error('No auth data passed to getUpdatedOauthPortalConfig.');
  }

  if (!auth.tokenInfo) {
    throw new Error(
      'No auth.tokenInfo data passed to getUpdatedOauthPortalConfig.'
    );
  }

  const config = {
    ...portalConfig,
    portalId: configUpdates.portalId,
    name: configUpdates.name || portalConfig.name,
    env: configUpdates.env || portalConfig.env,
    defaultMode: configUpdates.defaultMode || portalConfig.defaultMode,
    authType: OAUTH_AUTH_METHOD.value,
    auth,
  };

  delete config.apiKey;
  delete config.personalAccessKey;

  return config;
};

module.exports = {
  getUpdatedOauthPortalConfig,
};
