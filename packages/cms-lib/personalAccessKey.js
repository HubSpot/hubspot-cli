const open = require('open');
const moment = require('moment');
const {
  promptUser,
  PERSONAL_ACCESS_KEY_FLOW,
  PERSONAL_ACCESS_KEY,
} = require('@hubspot/cms-cli/lib/prompts');

const { HubSpotAuthError } = require('@hubspot/api-auth-lib/Errors');
const {
  getEnv,
  getPortalId,
  getPortalConfig,
  updatePortalConfig,
  updateDefaultPortal,
  writeConfig,
} = require('./lib/config');
const { getHubSpotWebsiteOrigin } = require('./lib/urls');
const { getValidEnv } = require('./lib/environment');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  ENVIRONMENTS,
} = require('./lib/constants');
const { logger } = require('./logger');
const { fetchAccessToken } = require('./api/localDevAuth');
const { logErrorInstance } = require('./errorHandlers');

const refreshRequests = new Map();

function getRefreshKey(personalAccessKey, expiration) {
  return `${personalAccessKey}-${expiration || 'fresh'}`;
}

async function getAccessToken(
  personalAccessKey,
  env = ENVIRONMENTS.PROD,
  portalId
) {
  let response;
  try {
    response = await fetchAccessToken(personalAccessKey, env, portalId);
  } catch (e) {
    if (e.response) {
      const errorOutput = `Error while retrieving new access token: ${e.response.body.message}.`;
      if (e.response.statusCode === 401) {
        throw new HubSpotAuthError(
          `${errorOutput} \nYour personal CMS access key is invalid. Please run "hs auth personalaccesskey" to reauthenticate. See https://designers.hubspot.com/docs/personal-access-keys for more information.`
        );
      } else {
        throw new HubSpotAuthError(errorOutput);
      }
    } else {
      throw e;
    }
  }
  return {
    portalId: response.hubId,
    accessToken: response.oauthAccessToken,
    expiresAt: moment(response.expiresAtMillis),
    scopeGroups: response.scopeGroups,
    encodedOauthRefreshToken: response.encodedOauthRefreshToken,
  };
}

async function refreshAccessToken(
  portalId,
  personalAccessKey,
  env = ENVIRONMENTS.PROD
) {
  const { accessToken, expiresAt } = await getAccessToken(
    personalAccessKey,
    env,
    portalId
  );
  const config = getPortalConfig(portalId);

  updatePortalConfig({
    ...config,
    portalId,
    tokenInfo: {
      accessToken,
      expiresAt: expiresAt.toISOString(),
    },
  });
  writeConfig();

  return accessToken;
}

async function getNewAccessToken(portalId, personalAccessKey, expiresAt, env) {
  const key = getRefreshKey(personalAccessKey, expiresAt);
  if (refreshRequests.has(key)) {
    return refreshRequests.get(key);
  }
  let accessToken;
  try {
    const refreshAccessPromise = refreshAccessToken(
      portalId,
      personalAccessKey,
      env
    );
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
      portalId,
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
const personalAccessKeyPrompt = async ({ env } = {}) => {
  const { name } = await promptUser(PERSONAL_ACCESS_KEY_FLOW);
  const portalId = getPortalId(name);
  const websiteOrigin = getHubSpotWebsiteOrigin(env || getEnv(name));
  if (portalId) {
    open(`${websiteOrigin}/personal-access-key/${portalId}`);
  } else {
    open(`${websiteOrigin}/l/personal-access-key`);
  }
  const { personalAccessKey } = await promptUser(PERSONAL_ACCESS_KEY);

  return {
    personalAccessKey,
    name,
    env,
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
const updateConfigWithPersonalAccessKey = async (configData, makeDefault) => {
  const { personalAccessKey, name, env } = configData;
  const accessKeyEnv = env || getEnv(name);

  let token;
  try {
    token = await getAccessToken(personalAccessKey, accessKeyEnv);
  } catch (err) {
    logErrorInstance(err);
    return;
  }
  const { portalId, accessToken, expiresAt } = token;

  updatePortalConfig({
    portalId,
    personalAccessKey,
    name,
    environment: getValidEnv(accessKeyEnv, true),
    authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    tokenInfo: { accessToken, expiresAt },
  });
  writeConfig();

  if (makeDefault) {
    updateDefaultPortal(name);
  }

  logger.success(
    `${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} created with ${PERSONAL_ACCESS_KEY_AUTH_METHOD.name}.`
  );
};

module.exports = {
  accessTokenForPersonalAccessKey,
  personalAccessKeyPrompt,
  updateConfigWithPersonalAccessKey,
};
