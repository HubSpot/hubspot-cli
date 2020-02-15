const open = require('open');
const moment = require('moment');
const {
  promptUser,
  PERSONAL_ACCESS_KEY_FLOW,
  PERSONAL_ACCESS_KEY,
} = require('@hubspot/cms-cli/lib/prompts');

const { HubSpotAuthError } = require('@hubspot/api-auth-lib/Errors');
const {
  getPortalConfig,
  updatePortalConfig,
  updateDefaultPortal,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
} = require('./lib/config');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  ENVIRONMENTS,
} = require('./lib/constants');
const { handleExit } = require('./lib/process');
const { getHubSpotWebsiteDomain } = require('./lib/environment');
const { logger } = require('./logger');
const { fetchAccessToken } = require('./api/localDevAuth');

const refreshRequests = new Map();

function getRefreshKey(personalAccessKey, expiration) {
  return `${personalAccessKey}-${expiration || 'fresh'}`;
}

async function getAccessToken(personalAccessKey, env = ENVIRONMENTS.PROD) {
  let response;
  try {
    response = await fetchAccessToken(personalAccessKey, env);
    return {
      portalId: response.hubId,
      accessToken: response.oauthAccessToken,
      expiresAt: moment(response.expiresAtMillis),
      scopeGroups: response.scopeGroups,
      encodedOauthRefreshToken: response.encodedOauthRefreshToken,
    };
  } catch (e) {
    if (e.response) {
      throw new HubSpotAuthError(
        `Error while retrieving new access token: ${e.response.body.message}`
      );
    } else {
      throw e;
    }
  }
}

async function refreshAccessToken(personalAccessKey, env = ENVIRONMENTS.PROD) {
  const { accessToken, expiresAt, portalId } = await getAccessToken(
    personalAccessKey,
    env
  );

  updatePortalConfig({
    portalId,
    tokenInfo: {
      accessToken,
      expiresAt,
    },
  });

  return accessToken;
}

async function getNewAccessToken(personalAccessKey, authTokenInfo, env) {
  const key = getRefreshKey(
    personalAccessKey,
    authTokenInfo && authTokenInfo.expiresAt
  );
  if (refreshRequests.has(key)) {
    return refreshRequests.get(key);
  }
  let accessToken;
  try {
    const refreshAccessPromise = refreshAccessToken(personalAccessKey, env);
    if (key) {
      refreshRequests.set(key, refreshAccessPromise);
    }
    accessToken = await refreshAccessPromise;
  } catch (e) {
    if (key) {
      refreshRequests.delete(key);
    }
    throw e;
  }
  return accessToken;
}

async function accessTokenForPersonalAccessKey(portalId) {
  const { auth, personalAccessKey, env } = getPortalConfig(portalId);
  const authTokenInfo = auth && auth.tokenInfo;
  const authDataExists = authTokenInfo && auth.tokenInfo.accessToken;

  if (
    !authDataExists ||
    moment()
      .add(30, 'minutes')
      .isAfter(moment(authTokenInfo.expiresAt))
  ) {
    return getNewAccessToken(
      personalAccessKey,
      authTokenInfo && authTokenInfo.expiresAt,
      env
    );
  }

  return auth.tokenInfo.accessToken;
}

/**
 * Prompts user for portal name, then opens their browser to the shortlink to personal-access-key
 */
const personalAccessKeyPrompt = async options => {
  const { name } = await promptUser(PERSONAL_ACCESS_KEY_FLOW);
  open(`${getHubSpotWebsiteDomain(options.env)}/l/personal-access-key`);
  const { personalAccessKey } = await promptUser(PERSONAL_ACCESS_KEY);

  return {
    personalAccessKey,
    name,
  };
};

/**
 * Adds a portal to the config using authType: personalAccessKey
 *
 * @param {object} configData Data containing personalAccessKey and name properties
 * @param {string} configData.personalAccessKey Personal access key string to place in config
 * @param {string} configData.name Unique name to identify this config entry
 * @param {boolean} makeDefault option to make the portal being added to the config the default portal
 */
const updateConfigWithPersonalAccessKey = async (
  configData,
  { makeDefault = false, env = ENVIRONMENTS.PROD, firstEntry = false } = {}
) => {
  createEmptyConfigFile();
  handleExit(deleteEmptyConfigFile);
  const { personalAccessKey, name } = configData;
  const { portalId, accessToken, expiresAt } = await getAccessToken(
    personalAccessKey,
    env
  );
  const updatedConfig = {
    portalId,
    name,
    env,
    personalAccessKey,
    authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    auth: {
      tokenInfo: { accessToken, expiresAt },
    },
  };

  updatePortalConfig(updatedConfig);

  if (makeDefault) {
    updateDefaultPortal(name);
  }

  logger.log(
    `Success: ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} ${
      firstEntry ? 'created' : 'updated'
    } with ${PERSONAL_ACCESS_KEY_AUTH_METHOD.name}.`
  );

  return updatedConfig;
};

module.exports = {
  accessTokenForPersonalAccessKey,
  personalAccessKeyPrompt,
  updateConfigWithPersonalAccessKey,
};
