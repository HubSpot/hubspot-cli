const { API_KEY_AUTH_METHOD } = require('../constants');
const { updatePortalConfigProps } = require('./file');

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
    ...updatePortalConfigProps(portalConfig, configUpdates),
    authType: API_KEY_AUTH_METHOD.value,
    apiKey,
  };

  delete config.auth;
  delete config.personalAccessKey;

  return config;
};

module.exports = {
  getUpdatedApiKeyPortalConfig,
};
