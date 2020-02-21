const { PERSONAL_ACCESS_KEY_AUTH_METHOD } = require('../constants');

/**
 * Generates a portalConfig object from previous values and desired updates
 * @param {object} portalConfig Existing personalaccesskey portalConfig
 * @param {object} configUpdates Object containing desired updates
 */
const getUpdatedPersonalAccessKeyPortalConfig = (
  portalConfig = {},
  configUpdates = {}
) => {
  const personalAccessKey =
    configUpdates.personalAccessKey || portalConfig.personalAccessKey;
  const auth = {
    ...portalConfig.auth,
    ...configUpdates.auth,
  };

  if (!personalAccessKey) {
    throw new Error(
      'No personalAccessKey passed to getUpdatedPersonalAccessKeyPortalConfig.'
    );
  }

  if (!auth) {
    throw new Error(
      'No auth data passed to getUpdatedPersonalAccessKeyPortalConfig.'
    );
  }

  if (!auth.tokenInfo) {
    throw new Error(
      'No auth.tokenInfo data passed to getUpdatedPersonalAccessKeyPortalConfig.'
    );
  }

  const config = {
    ...portalConfig,
    portalId: configUpdates.portalId,
    name: configUpdates.name || portalConfig.name,
    env: configUpdates.env || portalConfig.env,
    defaultMode: configUpdates.defaultMode || portalConfig.defaultMode,
    authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    personalAccessKey,
    auth,
  };

  return config;
};

module.exports = {
  getUpdatedPersonalAccessKeyPortalConfig,
};
