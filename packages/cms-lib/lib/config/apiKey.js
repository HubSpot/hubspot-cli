const { API_KEY_AUTH_METHOD } = require('../constants');

/**
 * Generates a portalConfig object from previous values and desired updates
 * @param {object} portalConfig Existing apiKey portalConfig
 * @param {object} configUpdates Object containing desired updates
 */
const getUpdatedApiKeyPortalConfig = (
  portalConfig = {},
  configUpdates = {}
) => {
  const apiKey = configUpdates.apiKey || portalConfig.apiKey;

  if (!apiKey) {
    throw new Error('No apiKey passed to getUpdatedApiKeyPortalConfig.');
  }

  const config = {
    ...portalConfig,
    portalId: configUpdates.portalId,
    name: configUpdates.name || portalConfig.name,
    env: configUpdates.env || portalConfig.env,
    defaultMode: configUpdates.defaultMode || portalConfig.defaultMode,
    authType: API_KEY_AUTH_METHOD.value,
    apiKey,
  };

  return config;
};

module.exports = {
  getUpdatedApiKeyPortalConfig,
};
