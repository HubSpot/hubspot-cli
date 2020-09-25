const moment = require('moment');
const { HubSpotAuthError } = require('./lib/models/Errors');
const {
  getPortalConfig,
  updatePortalConfig,
  writeConfig,
} = require('./lib/config');
const { ENVIRONMENTS } = require('./lib/constants');
const { fetchAccessToken } = require('./api/localDevAuth/unauthenticated');

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

module.exports = {
  accessTokenForPersonalAccessKey,
};
