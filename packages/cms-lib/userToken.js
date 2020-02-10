const open = require('open');
const moment = require('moment');
const {
  promptUser,
  USER_TOKEN_FLOW,
  USER_TOKEN,
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
  USER_TOKEN_AUTH_METHOD,
} = require('./lib/constants');
const { handleExit } = require('./lib/process');
const { logger } = require('./logger');
const { fetchAccessToken } = require('./api/localDevAuth');

const refreshRequests = new Map();

function getRefreshKeyForUserToken(userToken, expiration) {
  return `${userToken}-${expiration || 'fresh'}`;
}

async function getAccessToken(userToken, env = 'PROD') {
  let response;
  try {
    response = await fetchAccessToken(userToken, env);
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

async function refreshAccessToken(userToken, env = 'PROD') {
  const { accessToken, expiresAt, portalId } = await getAccessToken(
    userToken,
    env
  );
  const config = getPortalConfig(portalId);

  updatePortalConfig({
    ...config,
    portalId,
    tokenInfo: {
      accessToken,
      expiresAt,
    },
  });

  return accessToken;
}

async function getNewAccessToken(userToken, authTokenInfo, env) {
  const key = getRefreshKeyForUserToken(
    userToken,
    authTokenInfo && authTokenInfo.expiresAt
  );
  if (refreshRequests.has(key)) {
    return refreshRequests.get(key);
  }
  let accessToken;
  try {
    const refreshAccessPromise = refreshAccessToken(userToken, env);
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

async function accessTokenForUserToken(portalId) {
  const { auth, userToken, env } = getPortalConfig(portalId);
  const authTokenInfo = auth && auth.tokenInfo;
  const authDataExists = authTokenInfo && auth.tokenInfo.accessToken;

  if (
    !authDataExists ||
    moment()
      .add(30, 'minutes')
      .isAfter(moment(authTokenInfo.expiresAt))
  ) {
    return getNewAccessToken(
      userToken,
      authTokenInfo && authTokenInfo.expiresAt,
      env
    );
  }

  return auth.tokenInfo.accessToken;
}

/**
 * Prompts user for portal name, then opens their browser to the shortlink to user-token-ui
 */
const userTokenPrompt = async () => {
  const { name } = await promptUser(USER_TOKEN_FLOW);
  open(`https://app.hubspot.com/l/user-token`);
  const { userToken } = await promptUser(USER_TOKEN);

  return {
    userToken,
    name,
  };
};

/**
 * Adds a portal to the config using authType: userToken
 *
 * @param {object} configData Data containing userToken and name properties
 * @param {string} configData.userToken User token string to place in config
 * @param {string} configData.name Unique name to identify this config entry
 * @param {boolean} makeDefault option to make the portal being added to the config the default portal
 */
const updateConfigWithUserToken = async (configData, makeDefault) => {
  createEmptyConfigFile();
  handleExit(deleteEmptyConfigFile);
  const { userToken, name } = configData;
  const { portalId, accessToken, expiresAt } = await getAccessToken(userToken);

  updatePortalConfig({
    portalId,
    userToken,
    name,
    authType: USER_TOKEN_AUTH_METHOD.value,
    tokenInfo: { accessToken, expiresAt },
  });

  if (makeDefault) {
    updateDefaultPortal(name);
  }

  logger.log(
    `Success: ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} created with ${USER_TOKEN_AUTH_METHOD.name}.`
  );
};

module.exports = {
  accessTokenForUserToken,
  userTokenPrompt,
  updateConfigWithUserToken,
};
