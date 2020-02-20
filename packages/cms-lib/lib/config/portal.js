const { logger } = require('../../logger');
const {
  API_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('../constants');
const {
  getAndLoadConfigIfNeeded,
  setDefaultConfigPathIfUnset,
  writeConfig,
} = require('./file');
const { getUpdatedApiKeyPortalConfig } = require('./apiKey');
const { getUpdatedOauthPortalConfig } = require('./oauth2');
const {
  getUpdatedPersonalAccessKeyPortalConfig,
} = require('./personalAccessKey');

const getPortalConfig = portalId => {
  const config = getAndLoadConfigIfNeeded();
  return config.portals.find(portal => portal.portalId === portalId);
};

const getPortalId = nameOrId => {
  const config = getAndLoadConfigIfNeeded();
  let name;
  let portalId;
  let portal;
  if (!nameOrId) {
    if (config && config.defaultPortal) {
      name = config.defaultPortal;
    }
  } else {
    if (typeof nameOrId === 'number') {
      portalId = nameOrId;
    } else if (/^\d+$/.test(nameOrId)) {
      portalId = parseInt(nameOrId, 10);
    } else {
      name = nameOrId;
    }
  }

  if (name) {
    portal = config.portals.find(p => p.name === name);
  } else if (portalId) {
    portal = config.portals.find(p => p.portalId === portalId);
  }

  if (portal) {
    return portal.portalId;
  }

  return null;
};

const getPortalName = portalId => {
  return getPortalConfig(portalId).name;
};

/**
 * Method to update an existing portal config or create a new one
 * @param {object} configOptions An object containing properties to update in the portalConfig
 * @param {number} configOptions.portalId Portal ID to add/make updates to
 * @param {string} configOptions.authType Type of authentication used for this portalConfig
 * @param {string} configOptions.env Environment that this portal is located in(QA/PROD)
 * @param {string} configOptions.name Unique name used to reference this portalConfig
 * @param {string} configOptions.apiKey API key used in authType: apikey
 * @param {string} configOptions.defaultMode Default mode for uploads(draft or publish)
 * @param {string} configOptions.personalAccessKey Personal Access Key used in authType: personalaccesskey
 * @param {object} configOptions.auth Auth object used in oauth2 and personalaccesskey authTypes
 * @param {string} configOptions.auth.clientId Client ID used for oauth2
 * @param {string} configOptions.auth.clientSecret Client Secret used for oauth2
 * @param {array} configOptions.auth.scopes Scopes that are allowed access with auth
 * @param {object} configOptions.auth.tokenInfo Token Info used for oauth2 and personalaccesskey authTypes
 * @param {string} configOptions.auth.tokenInfo.accessToken Access token used for auth
 * @param {string} configOptions.auth.tokenInfo.expiresAt Date ISO of accessToken expiration
 */
const updatePortalConfig = configOptions => {
  const { portalId } = configOptions;

  if (!portalId) {
    throw new Error('A portalId is required to update the config');
  }

  const config = getAndLoadConfigIfNeeded();
  const portalConfig = getPortalConfig(portalId);
  const authType = configOptions.authType || portalConfig.authType;
  let updatedPortalConfig;

  switch (authType) {
    case PERSONAL_ACCESS_KEY_AUTH_METHOD.value: {
      updatedPortalConfig = getUpdatedPersonalAccessKeyPortalConfig(
        portalConfig,
        configOptions
      );
      break;
    }
    case OAUTH_AUTH_METHOD.value: {
      updatedPortalConfig = getUpdatedOauthPortalConfig(
        portalConfig,
        configOptions
      );
      break;
    }
    case API_KEY_AUTH_METHOD.value: {
      updatedPortalConfig = getUpdatedApiKeyPortalConfig(
        portalConfig,
        configOptions
      );
      break;
    }
    default: {
      throw new Error(
        `Unrecognized authType: ${authType} passed to updatePortalConfig.`
      );
    }
  }

  if (portalConfig) {
    logger.debug(`Updating config for ${portalId}`);
    const index = config.portals.indexOf(portalConfig);
    config.portals[index] = updatedPortalConfig;
  } else {
    logger.debug(`Adding config entry for ${portalId}`);
    if (config.portals) {
      config.portals.push(updatedPortalConfig);
    } else {
      config.portals = [updatedPortalConfig];
    }
  }
  writeConfig();

  return updatedPortalConfig;
};

/**
 * @throws {Error}
 */
const updateDefaultPortal = defaultPortal => {
  if (
    !defaultPortal ||
    (typeof defaultPortal !== 'number' && typeof defaultPortal !== 'string')
  ) {
    throw new Error(
      'A defaultPortal with value of number or string is required to update the config'
    );
  }

  const config = getAndLoadConfigIfNeeded();
  config.defaultPortal = defaultPortal;
  setDefaultConfigPathIfUnset();
  writeConfig();
};

module.exports = {
  getPortalConfig,
  getPortalId,
  getPortalName,
  updatePortalConfig,
  updateDefaultPortal,
};
